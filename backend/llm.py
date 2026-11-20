"""Chat-model and embedding factories, chosen by env vars.

Local dev keeps the old behaviour (Ollama). A deploy on a small server sets
LLM_PROVIDER=openai and EMBEDDING_PROVIDER=openai to use hosted APIs instead.
"openai" means any OpenAI-compatible endpoint, so OpenRouter works by setting
LLM_BASE_URL=https://openrouter.ai/api/v1.

Env vars:
  LLM_PROVIDER         ollama (default) | openai
  LLM_MODEL            model id; falls back to OLLAMA_MODEL, then qwen3.5:latest
  LLM_BASE_URL         OpenAI-compatible base URL (openai provider only)
  LLM_API_KEY          key for LLM_BASE_URL; falls back to OPENAI_API_KEY
  EMBEDDING_PROVIDER   ollama (default) | openai
  EMBEDDING_MODEL      default nomic-embed-text-v2-moe:latest / text-embedding-3-small
  EMBEDDING_BASE_URL   optional OpenAI-compatible base URL for embeddings
  EMBEDDING_API_KEY    falls back to OPENAI_API_KEY
"""
import os


def _provider(name: str) -> str:
    return os.getenv(name, "ollama").strip().lower()


def get_chat_llm(temperature: float = 0.7, model: str | None = None):
    model = model or os.getenv("LLM_MODEL") or os.getenv("OLLAMA_MODEL", "qwen3.5:latest")
    if _provider("LLM_PROVIDER") == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=os.getenv("LLM_BASE_URL") or None,
            api_key=os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY"),
            timeout=float(os.getenv("LLM_TIMEOUT", "120")),
        )
    from langchain_ollama import ChatOllama
    return ChatOllama(model=model, temperature=temperature)


def get_embeddings():
    if _provider("EMBEDDING_PROVIDER") == "openai":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
            base_url=os.getenv("EMBEDDING_BASE_URL") or None,
            api_key=os.getenv("EMBEDDING_API_KEY") or os.getenv("OPENAI_API_KEY"),
        )
    from langchain_ollama import OllamaEmbeddings
    return OllamaEmbeddings(model=os.getenv("EMBEDDING_MODEL", "nomic-embed-text-v2-moe:latest"))
