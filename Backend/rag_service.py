import os
from pathlib import Path

CHROMA_COLLECTION_NAME = "classroom_resources"


def get_embeddings():
    from langchain_community.embeddings import SentenceTransformerEmbeddings
    return SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")


def get_chroma_client(classroom_id: int):
    from langchain_community.vectorstores import Chroma
    persist_directory = f"./chroma_db/classroom_{classroom_id}"
    os.makedirs(persist_directory, exist_ok=True)
    return Chroma(
        collection_name=f"{CHROMA_COLLECTION_NAME}_{classroom_id}",
        embedding_function=get_embeddings(),
        persist_directory=persist_directory
    )


def index_resource(file_path: str, classroom_id: int, resource_id: int) -> bool:
    """
    Index a PDF resource into ChromaDB.
    Automatically detects handwritten PDFs and uses OCR (Tesseract) for those,
    and PyMuPDF direct-text extraction for regular text-based PDFs.
    """
    try:
        from Backend.rag_pipeline.indexing.detector import is_handwritten
        from Backend.rag_pipeline.indexing.extractors import extract_text
        from Backend.rag_pipeline.indexing.chunker import create_langchain_documents

        print(f"[RAG] Detecting document type for: {file_path}")
        hw = is_handwritten(file_path)
        print(f"[RAG] Handwritten: {hw}")

        pages = extract_text(file_path, is_handwritten=hw)
        if not pages:
            print(f"[RAG] No text extracted from {file_path}")
            return False

        print(f"[RAG] Extracted {len(pages)} pages")

        documents = create_langchain_documents(pages)
        if not documents:
            print(f"[RAG] No chunks created from {file_path}")
            return False

        # Attach classroom and resource metadata to every chunk
        for doc in documents:
            doc.metadata["classroom_id"] = classroom_id
            doc.metadata["resource_id"] = resource_id

        print(f"[RAG] Indexing {len(documents)} chunks into Chroma for classroom {classroom_id}")
        vectorstore = get_chroma_client(classroom_id)
        vectorstore.add_documents(documents)

        print(f"[RAG] Successfully indexed resource {resource_id}")
        return True

    except Exception as e:
        print(f"[RAG] Error indexing resource: {e}")
        import traceback
        traceback.print_exc()
        return False


def index_resource_from_url(url: str, classroom_id: int, resource_id: int) -> bool:
    """
    Download a PDF from a URL, then index it using the OCR-aware pipeline.
    """
    import tempfile
    import httpx
    try:
        response = httpx.get(url, timeout=60.0)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(response.content)
            tmp_path = tmp_file.name

        result = index_resource(tmp_path, classroom_id, resource_id)
        os.remove(tmp_path)
        return result

    except Exception as e:
        print(f"[RAG] Error downloading/indexing resource from URL: {e}")
        import traceback
        traceback.print_exc()
        return False


def query_resources(query: str, classroom_id: int, k: int = 4):
    try:
        vectorstore = get_chroma_client(classroom_id)
        results = vectorstore.similarity_search(
            query,
            k=k,
            filter={"classroom_id": classroom_id}
        )
        return results
    except Exception as e:
        print(f"[RAG] Error querying resources: {e}")
        return []


def format_context(results):
    context = ""
    for i, doc in enumerate(results, 1):
        context += f"\n--- Document {i} ---\n"
        context += f"Source: {doc.metadata.get('source', 'Unknown')}\n"
        page = doc.metadata.get('page', '')
        if page:
            context += f"Page: {page}\n"
        doc_type = doc.metadata.get('type', '')
        if doc_type == 'ocr':
            context += "(extracted via OCR)\n"
        context += doc.page_content + "\n"
    return context


def generate_rag_response(query: str, classroom_id: int, conversation_history: list | None = None):
    results = query_resources(query, classroom_id)
    if not results:
        return (
            "No relevant information found in the classroom resources. "
            "Please upload some PDF resources to the classroom and wait for them to be indexed."
        )

    context = format_context(results)

    try:
        from langchain_groq import ChatGroq
        from langchain_core.prompts import ChatPromptTemplate

        messages = [
            ("system", """You are a helpful teaching assistant for a classroom. Use the following context from the classroom's PDF resources to answer the user's question.

Format your responses nicely using:
- Clear headings and subheadings when needed
- Bullet points for lists
- Bold text for important terms or key points
- Numbered lists for sequential steps or rankings
- Short paragraphs for explanations

Be thorough but concise. If the answer cannot be found in the context provided, clearly state that the information is not available.

If asked questions unrelated to the classroom materials (like general knowledge, personal questions, etc.), politely say you can only help with classroom-related questions.

Context:
{context}"""),
        ]

        if conversation_history:
            for msg in conversation_history:
                role = "user" if msg["role"] == "user" else "assistant"
                messages.append((role, msg["content"]))

        messages.append(("user", "{query}"))

        prompt = ChatPromptTemplate.from_messages(messages)

        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.7,
            api_key=os.getenv("GROQ_API_KEY")
        )

        chain = prompt | llm
        response = chain.invoke({"context": context, "query": query})
        return response.content

    except Exception as e:
        print(f"[RAG] Error generating LLM response: {e}")
        return f"Here is what I found in the classroom resources:\n{context}"


def generate_conversation_title(query: str) -> str:
    try:
        from langchain_groq import ChatGroq
        from langchain_core.prompts import ChatPromptTemplate

        prompt = ChatPromptTemplate.from_messages([
            ("system", "Generate a very short title (3-6 words) for a conversation that starts with this question. Return ONLY the title, no quotes or punctuation."),
            ("user", "{query}")
        ])

        llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.3,
            api_key=os.getenv("GROQ_API_KEY")
        )

        chain = prompt | llm
        response = chain.invoke({"query": query})
        title = response.content.strip().strip("\"'")
        return title[:60]

    except Exception as e:
        print(f"[RAG] Error generating title: {e}")
        fallback = (query[:50] + "...") if len(query) > 50 else query
        return fallback
