from typing import List
from langchain_community.embeddings import SentenceTransformerEmbeddings


def get_embedder():
    return SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")


def embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    embedder = get_embedder()
    return [embedder.embed_query(text) for text in texts]