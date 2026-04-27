from typing import List
from pathlib import Path
from langchain_core.documents import Document
from .state import PipelineState
from .detector import is_handwritten as detect_handwritten
from .extractors import extract_text
from .chunker import create_langchain_documents


def detect_document_type(state: PipelineState) -> PipelineState:
    pdf_path = state["pdf_path"]
    is_hw = detect_handwritten(str(Path(pdf_path).resolve()))
    return {**state, "is_handwritten": is_hw}


def extract_pages(state: PipelineState) -> PipelineState:
    pdf_path = state["pdf_path"]
    is_hw = state.get("is_handwritten", False)
    pages = extract_text(str(Path(pdf_path).resolve()), is_handwritten=is_hw)
    if not pages:
        return {**state, "error": "No text extracted from PDF"}
    return {**state, "pages": pages}


def chunk_documents(state: PipelineState) -> PipelineState:
    pages = state["pages"]
    docs = create_langchain_documents(pages)
    if not docs:
        return {**state, "error": "No chunks created"}
    return {**state, "chunks": docs}


def index_to_vectorstore(state: PipelineState) -> PipelineState:
    from .chroma_client import get_vectorstore

    chunks = state["chunks"]
    pdf_path = state["pdf_path"]
    is_hw = state.get("is_handwritten", False)

    vectorstore = get_vectorstore("clarix_docs")

    ids = [f"{Path(pdf_path).stem}_chunk_{i}" for i in range(len(chunks))]
    vectorstore.add_documents(documents=chunks, ids=ids)

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