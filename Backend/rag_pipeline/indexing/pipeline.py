from pathlib import Path
from typing import List
from langgraph.graph import StateGraph, END
from .state import PipelineState
from .nodes import (
    detect_document_type,
    extract_pages,
    chunk_documents,
    index_to_vectorstore,
)


def should_continue(state: PipelineState) -> bool:
    return "error" not in state


workflow = StateGraph(PipelineState)

workflow.add_node("detect", detect_document_type)
workflow.add_node("extract", extract_pages)
workflow.add_node("chunk", chunk_documents)
workflow.add_node("index", index_to_vectorstore)

workflow.set_entry_point("detect")
workflow.add_edge("detect", "extract")
workflow.add_edge("extract", "chunk")
workflow.add_edge("chunk", "index")
workflow.add_edge("index", END)

graph = workflow.compile()


def index_pdf(pdf_path: str, collection_name: str = "clarix_docs") -> dict:
    """Complete indexing pipeline for a single PDF using LangGraph."""
    result = graph.invoke({"pdf_path": pdf_path})

    if "error" in result:
        return {
            "success": False,
            "message": result["error"],
            "pdf": str(Path(pdf_path).resolve()),
        }

    return result["result"]


def search_similar(query: str, collection_name: str = "clarix_docs", n_results: int = 5) -> dict:
    """Search for similar documents using LangChain Chroma."""
    from .chroma_client import get_vectorstore

    vectorstore = get_vectorstore(collection_name)
    docs = vectorstore.similarity_search_with_score(query, k=n_results)

    return {
        "documents": [doc.page_content for doc in docs],
        "metadatas": [doc.metadata for doc in docs],
        "distances": [score for _, score in docs],
    }