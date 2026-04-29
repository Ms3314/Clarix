import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_community.embeddings import SentenceTransformerEmbeddings
import chromadb

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()  # Also try loading from current directory


def get_embeddings():
    return SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")


def get_chroma_client():
    api_key = os.getenv("CHROMA_API_KEY")
    if not api_key:
        raise ValueError("CHROMA_API_KEY not found in .env")

    return chromadb.CloudClient(
        api_key=api_key,
        tenant="dbf4a556-9827-4d33-b941-82278f0bb043",
        database="clarix"
    )


def get_vectorstore(collection_name: str = "clarix_docs"):
    return Chroma(
        collection_name=collection_name,
        embedding_function=get_embeddings(),
        client=get_chroma_client(),
    )