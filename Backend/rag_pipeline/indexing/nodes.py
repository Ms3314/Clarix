from typing import List
from pathlib import Path
from langchain_core.documents import Document
from .state import PipelineState
from .detector import is_handwritten as detect_handwritten
from .extractors import extract_text
from .chunker import create_langchain_documents


def detect_document_type(state: PipelineState) -> PipelineState:
    pdf_path = state["pdf_path"]
    print(f"\n[NODE: detect_document_type] Input PDF: {pdf_path}")
    is_hw = detect_handwritten(str(Path(pdf_path).resolve()))
    print(f"[NODE: detect_document_type] Detected type: {'handwritten' if is_hw else 'text'}")
    return {**state, "is_handwritten": is_hw}


def extract_pages(state: PipelineState) -> PipelineState:
    pdf_path = state["pdf_path"]
    is_hw = state.get("is_handwritten", False)
    print(f"\n[NODE: extract_pages] Input PDF: {pdf_path}")
    print(f"[NODE: extract_pages] Is handwritten: {is_hw}")
    pages = extract_text(str(Path(pdf_path).resolve()), is_handwritten=is_hw)
    print(f"[NODE: extract_pages] Extracted {len(pages) if pages else 0} pages")
    if not pages:
        return {**state, "error": "No text extracted from PDF"}
    return {**state, "pages": pages}


def chunk_documents(state: PipelineState) -> PipelineState:
    pages = state["pages"]
    print(f"\n[NODE: chunk_documents] Input pages: {len(pages)}")
    docs = create_langchain_documents(pages)
    print(f"[NODE: chunk_documents] Created {len(docs) if docs else 0} chunks")
    if not docs:
        return {**state, "error": "No chunks created"}
    return {**state, "chunks": docs}


def index_to_vectorstore(state: PipelineState) -> PipelineState:
    from .chroma_client import get_vectorstore

    chunks = state["chunks"]
    pdf_path = state["pdf_path"]
    is_hw = state.get("is_handwritten", False)

    print(f"\n[NODE: index_to_vectorstore] Indexing PDF: {pdf_path}")
    print(f"[NODE: index_to_vectorstore] Document type: {'handwritten' if is_hw else 'text'}")
    print(f"[NODE: index_to_vectorstore] Number of chunks: {len(chunks)}")

    vectorstore = get_vectorstore("clarix_docs")

    ids = [f"{Path(pdf_path).stem}_chunk_{i}" for i in range(len(chunks))]
    vectorstore.add_documents(documents=chunks, ids=ids)

    print(f"[NODE: index_to_vectorstore] Indexed {len(ids)} documents to ChromaDB")

    return {
        **state,
        "doc_ids": ids,
        "result": {
            "success": True,
            "pdf": str(Path(pdf_path).resolve()),
            "type": "handwritten" if is_hw else "text",
            "pages": len(state["pages"]),
            "chunks": len(chunks),
            "doc_ids": ids,
        },
    }