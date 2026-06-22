from pathlib import Path
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
import chromadb

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()


def get_embeddings():
    return OllamaEmbeddings(model="nomic-embed-text-v2-moe")


def get_chroma_client():
    return chromadb.PersistentClient(path="./chroma_db")


def get_vectorstore(collection_name: str = "clarix_docs"):
    return Chroma(
        collection_name=collection_name,
        embedding_function=get_embeddings(),
        client=get_chroma_client(),
    )
