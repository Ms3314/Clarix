import json
import re
from typing import Optional
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

_DELIMITER = "=" * 20
_MARKER_RE = re.compile(r"===\s*(.+?)\s*===", re.IGNORECASE)
_ARROW_FIX_RE = re.compile(r"([A-Z])[\u2019'](\s*)")
_QN_RE = re.compile(r"^\s*(?:Q\.?\s*)?(\d+)\s*[.)]?\s*(?:\(([a-zA-Z])\))?", re.IGNORECASE)
_QN_SUB_ONLY_RE = re.compile(r"^\s*\(([a-zA-Z])\)\s*")


def extract_metadata_llm(full_text: str, groq_model: str = "llama-3.3-70b-versatile") -> dict:
    system = (
        "You are a question paper metadata extractor. Extract the year, exam name, "
        "and exam code from the question paper text below.\n\n"
        "Return ONLY valid JSON in this exact format — no markdown, no backticks, no extra text:\n"
        '{"year": 2024, "exam_name": "BE CSE AICTE SEM V ...", "subject" : "compiler design" , "exam_code": "CS101"}\n\n'
        "Rules:\n"
        "- year: the 4-digit year of the examination. If not found, use null.\n"
        "- exam_name: the full subject/examination name as written on the paper itself "
        "(NOT the filename). If not found, use null.\n"
        "- exam_code: the subject/course code if visible on the paper. If not found, use null."
    )

    llm = ChatGroq(model=groq_model, temperature=0.0)

    try:
        response = llm.invoke([SystemMessage(content=system), HumanMessage(content=full_text[:3000])])
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw).strip()
        data = json.loads(raw)
        return {
            "year": data.get("year"),
            "exam_name": data.get("exam_name"),
            "exam_code": data.get("exam_code"),
            "subject" : data.get("subject")
        }
    except Exception as e:
        print(f"[QP Chunker] Metadata extraction failed: {e}")
        return {"year": None, "exam_name": None, "exam_code": None}


def segment_questions_llm(full_text: str, groq_model: str = "llama-3.3-70b-versatile") -> str:
    system = (
        f"You are a question paper segmenter. Insert `{_DELIMITER}` between each "
        "distinct question, and mark section types.\n\n"
        "STRICT RULES:\n"
        f"1. Insert `{_DELIMITER}` ONLY between questions — not at start or end.\n"
        "2. Question papers have SAQ (Short Answer Questions) and LAQ (Long Answer "
        "Questions) sections. When the section type changes, insert `=== SAQ ===` "
        "or `=== LAQ ===` on its own line BEFORE the first question of that section.\n"
         "3. Output ONLY the question text with delimiters and section markers. "
         "NO explanations, NO headings, NO markdown, NO extra text.\n"
         "4. Split each sub-question (a, b, c, i, ii) into its OWN chunk with its "
         "own `====================` between them. Do NOT group sub-questions "
         "under one parent — each stands alone.\n"
         "5. If the paper includes answer keys, solutions, or worked-out answers, "
        "EXCLUDE them. Include only the question text.\n"
        "6. Ignore page headers, footers, and running text that repeats on every page "
        "(like 'FACULTY OF ENGINEERING', 'Subject: ...', page numbers).\n"
        "7. Preserve the original question wording."
    )

    llm = ChatGroq(model=groq_model, temperature=0.0)

    try:
        response = llm.invoke([SystemMessage(content=system), HumanMessage(content=full_text)])
        result = response.content.strip()
        result = re.sub(r"^```(?:text)?\s*|\s*```$", "", result).strip()
        return result
    except Exception as e:
        print(f"[QP Chunker] Question segmentation failed: {e}")
        return ""


def _get_answer_type(text: str) -> str | None:
    m = _MARKER_RE.search(text)
    if not m:
        return None
    t = m.group(1).strip().lower()
    if any(w in t for w in ("saq", "short")):
        return "short"
    if any(w in t for w in ("laq", "long")):
        return "long"
    return None


def _clean_ocr_text(text: str) -> str:
    text = _ARROW_FIX_RE.sub(r"\1 → ", text)
    return re.sub(r" {2,}", " ", text)


def _strip_marker_lines(text: str) -> str:
    lines = text.split("\n")
    clean = [l for l in lines if not _MARKER_RE.match(l.strip())]
    return "\n".join(clean).strip()


def _extract_qn(text: str, fallback: int) -> str:
    m = _QN_RE.match(text)
    if m and m.group(1):
        num = m.group(1)
        sub = m.group(2)
        return f"{num}.{sub}" if sub else num
    m = _QN_SUB_ONLY_RE.match(text)
    if m:
        return f"{fallback}.{m.group(1)}"
    return str(fallback)


def smart_chunk_question_paper(
    pages: list[dict],
    extra_metadata: Optional[dict] = None,
    groq_model: str = "llama-3.3-70b-versatile",
) -> list[Document]:
    extra_metadata = extra_metadata or {}

    full_text = "\n".join(p["text"] for p in pages if p.get("text"))
    if not full_text.strip():
        return []

    full_text = _clean_ocr_text(full_text)

    metadata = extract_metadata_llm(full_text, groq_model)
    print(f"[QP Chunker] Metadata: {metadata}")

    segmented = segment_questions_llm(full_text, groq_model)
    if not segmented:
        return []

    parts = [p.strip() for p in segmented.split(_DELIMITER) if p.strip()]
    if not parts:
        return []

    current_answer_type = None
    docs = []

    for part in parts:
        at = _get_answer_type(part)
        if at is not None:
            current_answer_type = at

        clean = _strip_marker_lines(part)
        if not clean:
            continue

        doc_metadata = {
            **metadata,
            "chunk_type": "question",
            "question_number": _extract_qn(clean, len(docs) + 1),
            "answer_type": current_answer_type,
            **extra_metadata,
        }
        docs.append(Document(page_content=clean, metadata=doc_metadata))

    print(f"[QP Chunker] Created {len(docs)} question chunks")
    return docs
