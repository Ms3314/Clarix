import re
import json
from typing import Optional
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate


_QUESTION_START = re.compile(
    r"^(?:Q\.?\s*)?(\d{1,2})[.)\s]\s*(?:\((\d+)\s*[Mm]arks?\))?(.*)$",
    re.IGNORECASE,
)

_MARKS_INLINE = re.compile(r"\(?\[?(\d{1,2})\s*[Mm](?:arks?)?\]?\)?")

_SECTION_HEADER = re.compile(r"^(?:section|part)\s*[-:]?\s*([A-Za-z])\b", re.IGNORECASE)


def parse_qp_header(full_text: str) -> dict:
    meta = {"subject": None, "year": None, "exam_type": None}

    year_match = re.search(r"\b(20\d{2})\b", full_text[:500])
    if year_match:
        meta["year"] = int(year_match.group(1))

    exam_patterns = [
        r"\b(mid[\s\-]?sem(?:ester)?)\b",
        r"\b(end[\s\-]?sem(?:ester)?)\b",
        r"\b(mid[\s\-]?term)\b",
        r"\b(final)\b",
        r"\b(quiz[\s\-]?\d?)\b",
        r"\b(unit[\s\-]?test[\s\-]?\d?)\b",
        r"\b(internal[\s\-]?\d?)\b",
    ]
    for pat in exam_patterns:
        m = re.search(pat, full_text[:500], re.IGNORECASE)
        if m:
            meta["exam_type"] = m.group(1).strip().lower().replace(" ", "_")
            break

    lines = [l.strip() for l in full_text.split("\n") if l.strip()]
    for line in lines[:6]:
        if re.match(r"^[\d\W]+$", line):
            continue
        if len(line) < 5:
            continue
        if re.match(r"^[A-Za-z\s\-/:&()]+$", line) and len(line) > 6:
            skip_words = {"roll", "name", "date", "time", "max", "marks", "department", "semester"}
            if not any(w in line.lower() for w in skip_words):
                meta["subject"] = line.strip()
                break

    return meta


def _extract_marks(text: str) -> Optional[int]:
    m = _MARKS_INLINE.search(text)
    return int(m.group(1)) if m else None


def _classify_answer_type(marks: Optional[int], section: Optional[str]) -> str:
    if marks is not None:
        return "short" if marks <= 5 else "long"
    if section:
        return "short" if section.upper() in ("A",) else "long"
    return "unknown"


def chunk_question_paper(
    pages: list[dict],
    extra_metadata: Optional[dict] = None,
) -> list[Document]:
    extra_metadata = extra_metadata or {}

    full_text = "\n".join(p["text"] for p in pages if p.get("text"))
    if not full_text.strip():
        return []

    header = parse_qp_header(full_text)
    lines = full_text.split("\n")

    chunks: list[Document] = []
    current_lines: list[str] = []
    current_q_num: Optional[int] = None
    current_marks: Optional[int] = None
    current_section: Optional[str] = None
    question_counter = 0

    def _flush(q_num, marks, section, lines_buf):
        nonlocal question_counter
        if not lines_buf:
            return
        text = " ".join(l.strip() for l in lines_buf if l.strip())
        if not text:
            return

        question_counter += 1
        resolved_marks = marks or _extract_marks(text)
        answer_type = _classify_answer_type(resolved_marks, section)

        metadata = {
            **header,
            "chunk_type": "question",
            "question_number": q_num if q_num is not None else question_counter,
            "marks": resolved_marks,
            "answer_type": answer_type,
            "section": section,
            **extra_metadata,
        }
        chunks.append(Document(page_content=text, metadata=metadata))

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        sec_match = _SECTION_HEADER.match(stripped)
        if sec_match:
            _flush(current_q_num, current_marks, current_section, current_lines)
            current_lines = []
            current_q_num = None
            current_marks = None
            current_section = sec_match.group(1).upper()
            continue

        q_match = _QUESTION_START.match(stripped)
        if q_match:
            _flush(current_q_num, current_marks, current_section, current_lines)
            current_lines = []

            current_q_num = int(q_match.group(1))
            inline_marks = int(q_match.group(2)) if q_match.group(2) else None
            rest_of_line = q_match.group(3).strip()

            current_marks = inline_marks or _extract_marks(rest_of_line)
            current_lines = [rest_of_line] if rest_of_line else []
        else:
            current_lines.append(stripped)

    _flush(current_q_num, current_marks, current_section, current_lines)

    return chunks


def chunk_question_paper_llm(
    pages: list[dict],
    extra_metadata: Optional[dict] = None,
    groq_model: str = "llama-3.3-70b-versatile",
) -> list[Document]:
    extra_metadata = extra_metadata or {}
    full_text = "\n".join(p["text"] for p in pages if p.get("text"))
    header = parse_qp_header(full_text)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a question paper parser. Extract every question "
         "from the text below and return ONLY a JSON array. Each item must "
         "have these fields: question_number (int), question_text (string, "
         "the full question), marks (int or null if not found), section "
         "(string like 'A' or 'B', or null). Return ONLY the JSON array. "
         "No explanation, no markdown, no backticks."),
        ("user", "Question paper text:\n\n{text}"),
    ])

    llm = ChatGroq(model=groq_model, temperature=0.0)
    chain = prompt | llm

    try:
        response = chain.invoke({"text": full_text[:6000]})
        raw = response.content.strip()
        raw = re.sub(r"^```json|^```|```$", "", raw, flags=re.MULTILINE).strip()
        questions = json.loads(raw)
    except Exception as e:
        print(f"[QP Chunker] LLM fallback failed: {e}")
        return []

    docs = []
    for q in questions:
        marks = q.get("marks")
        section = q.get("section")
        answer_type = _classify_answer_type(marks, section)
        metadata = {
            **header,
            "chunk_type": "question",
            "question_number": q.get("question_number"),
            "marks": marks,
            "answer_type": answer_type,
            "section": section,
            **extra_metadata,
        }
        docs.append(Document(page_content=q.get("question_text", ""), metadata=metadata))

    return docs


def smart_chunk_question_paper(
    pages: list[dict],
    extra_metadata: Optional[dict] = None,
    llm_fallback_threshold: int = 2,
) -> list[Document]:
    docs = chunk_question_paper(pages, extra_metadata)

    if len(docs) < llm_fallback_threshold:
        print(f"[QP Chunker] Regex found {len(docs)} questions — trying LLM fallback")
        docs = chunk_question_paper_llm(pages, extra_metadata)

    print(f"[QP Chunker] Final chunk count: {len(docs)}")
    return docs
