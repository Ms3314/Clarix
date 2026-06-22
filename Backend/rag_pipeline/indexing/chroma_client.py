import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
import chromadb

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()


def get_embeddings():
    return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


def get_chroma_client():
    return chromadb.CloudClient(
        api_key=os.getenv("CHROMA_API_KEY"),
        tenant=os.getenv("CHROMA_TENANT", "default"),
        database=os.getenv("CHROMA_DATABASE", "default"),
    )


def get_vectorstore(collection_name: str = "clarix_docs"):
    return Chroma(
        collection_name=collection_name,
        embedding_function=get_embeddings(),
        client=get_chroma_client(),
    )
