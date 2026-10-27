"""Build a local Chroma index of the whole OSTEP book for retrieval evals.

Mirrors the production indexing path in backend/rag_service.py (PyMuPDF text extraction, then the
per-page character chunker), but writes to a local persistent Chroma so evals never touch
Chroma Cloud. Each (embedding, chunk size, overlap) combination gets its own collection.

Usage:
  python3 -m evals.retrieval_index --embedding openai-small
  python3 -m evals.retrieval_index --embedding openai-small --chunk-size 1000 --overlap 100
"""
import argparse
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
PDF = Path(__file__).resolve().parent / "corpus" / "ostep.pdf"
INDEX_DIR = Path(__file__).resolve().parent / ".index"

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")


def get_embeddings(name: str):
    if name == "openai-small":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(model="text-embedding-3-small")
    if name == "openai-large":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(model="text-embedding-3-large")
    if name == "nomic":
        from langchain_ollama import OllamaEmbeddings
        return OllamaEmbeddings(model="nomic-embed-text-v2-moe:latest")
    raise ValueError(f"unknown embedding {name!r}")


def collection_name(embedding: str, chunk_size: int, overlap: int, clean: bool = False) -> str:
    return f"ostep_{embedding}_c{chunk_size}_o{overlap}{'_clean' if clean else ''}".replace("-", "_")


def get_vectorstore(embedding: str, chunk_size: int, overlap: int, clean: bool = False):
    import chromadb
    from langchain_chroma import Chroma
    client = chromadb.PersistentClient(path=str(INDEX_DIR))
    return Chroma(
        collection_name=collection_name(embedding, chunk_size, overlap, clean),
        embedding_function=get_embeddings(embedding),
        client=client,
    )


def build(embedding: str, chunk_size: int, overlap: int, clean: bool = False, batch: int = 256):
    from langchain_core.documents import Document
    from backend.rag_pipeline.indexing.chunker import chunk_pages
    from backend.rag_pipeline.indexing.extractors import extract_text_from_pdf

    pages = extract_text_from_pdf(str(PDF))
    if clean:
        from evals.text_clean import strip_headers_footers
        pages = strip_headers_footers(pages)
    chunks = chunk_pages(pages, chunk_size=chunk_size, overlap=overlap)
    docs = [Document(page_content=c["text"],
                     metadata={"page": c["page"], "chunk_index": c["chunk_index"], "type": c["type"]})
            for c in chunks]
    ids = [f"p{c['page']}-c{c['chunk_index']}" for c in chunks]

    name = collection_name(embedding, chunk_size, overlap, clean)
    store = get_vectorstore(embedding, chunk_size, overlap, clean)
    existing = store._collection.count()
    if existing == len(docs):
        print(f"{name} already built ({existing} chunks)")
        return
    start = time.time()
    for i in range(0, len(docs), batch):
        store.add_documents(docs[i:i + batch], ids=ids[i:i + batch])
    print(f"indexed {len(docs)} chunks from {len(pages)} pages into {name} in {time.time() - start:.0f}s")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--embedding", default="openai-small", choices=["openai-small", "openai-large", "nomic"])
    ap.add_argument("--chunk-size", type=int, default=500)
    ap.add_argument("--overlap", type=int, default=50)
    ap.add_argument("--clean", action="store_true", help="strip running headers/footers before chunking")
    a = ap.parse_args()
    build(a.embedding, a.chunk_size, a.overlap, a.clean)
