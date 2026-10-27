from typing import List
from langchain_ollama import OllamaEmbeddings


def get_embedder():
    return OllamaEmbeddings(model="nomic-embed-text-v2-moe")


def embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    embedder = get_embedder()
    return [embedder.embed_query(text) for text in texts]
