from typing import TypedDict, List, Optional
from langchain_core.documents import Document


class PipelineState(TypedDict):
    pdf_path: str
    is_handwritten: Optional[bool]
    pages: Optional[List[dict]]
    chunks: Optional[List[Document]]
    doc_ids: Optional[List[str]]
    result: Optional[dict]
    error: Optional[str]