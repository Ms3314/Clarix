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


def create_graph():
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

    return workflow.compile()


graph = create_graph()