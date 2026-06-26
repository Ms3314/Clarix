import os
from pathlib import Path
from dotenv import load_dotenv

CHROMA_COLLECTION_PREFIX = "classroom_"

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)


def get_embeddings():
    from langchain_huggingface import HuggingFaceEmbeddings
    return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def get_embeddings_openAI():
    from langchain_openai import OpenAIEmbeddings
    return OpenAIEmbeddings(model="text-embedding-3-small")

def _resolve_invite_code(classroom_id: int) -> str:
    from Backend.Database import SessionLocal
    from Backend.models import Classroom
    db = SessionLocal()
    try:
        classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
        return classroom.invite_code if classroom else str(classroom_id)
    finally:
        db.close()


def get_vectorstore(classroom_id: int):
    import chromadb
    from langchain_chroma import Chroma
    invite_code = _resolve_invite_code(classroom_id)
    collection_name = f"{CHROMA_COLLECTION_PREFIX}{invite_code}"
    chroma_client = chromadb.CloudClient(
        api_key=os.getenv("CHROMA_API_KEY"),
        tenant=os.getenv("CHROMA_TENANT", "default"),
        database=os.getenv("CHROMA_DATABASE", "default"),
    )
    return Chroma(
        collection_name=collection_name,
        embedding_function=get_embeddings(),
        client=chroma_client,
    )


def index_resource(file_path: str, classroom_id: int, resource_id: int, resource_type: str = 'notes') -> bool:
    try:
        from Backend.rag_pipeline.indexing.detector import is_handwritten
        from Backend.rag_pipeline.indexing.extractors import extract_text

        print(f"[RAG] Detecting document type for: {file_path} (type: {resource_type})")
        hw = is_handwritten(file_path)
        print(f"[RAG] Handwritten: {hw}")

        pages = extract_text(file_path, is_handwritten=hw)
        if not pages:
            print(f"[RAG] No text extracted from {file_path}")
            return False

        print(f"[RAG] Extracted {len(pages)} pages")
        print("the pages are the following " , pages)
        if resource_type == 'pyq':
            from Backend.rag_pipeline.indexing.qp_chunker import smart_chunk_question_paper
            extra_meta = {
                "classroom_id": classroom_id,
                "resource_id": resource_id,
                "source": file_path,
            }
            # this is the different chunker for the question papper we have over here
            documents = smart_chunk_question_paper(pages, extra_metadata=extra_meta)
        else:
            from Backend.rag_pipeline.indexing.chunker import create_langchain_documents
            documents = create_langchain_documents(pages)
            chunk_type = 'note' if resource_type == 'notes' else resource_type
            for doc in documents:
                doc.metadata["classroom_id"] = classroom_id
                doc.metadata["resource_id"] = resource_id
                doc.metadata["source"] = file_path
                doc.metadata["chunk_type"] = chunk_type

        if not documents:
            print(f"[RAG] No chunks created from {file_path}")
            return False

        vectorstore = get_vectorstore(classroom_id)
        print(f"[RAG] Indexing {len(documents)} chunks into collection {vectorstore._collection.name} (classroom {classroom_id})")
        vectorstore.add_documents(documents)

        print(f"[RAG] Successfully indexed resource {resource_id}")
        return True

    except Exception as e:
        print(f"[RAG] Error indexing resource: {e}")
        import traceback
        traceback.print_exc()
        return False


def index_resource_from_url(url: str, classroom_id: int, resource_id: int, resource_type: str = 'notes') -> bool:
    import tempfile
    import httpx
    try:
        response = httpx.get(url, timeout=60.0)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(response.content)
            tmp_path = tmp_file.name

        result = index_resource(tmp_path, classroom_id, resource_id, resource_type)
        os.remove(tmp_path)
        return result

    except Exception as e:
        print(f"[RAG] Error downloading/indexing resource from URL: {e}")
        import traceback
        traceback.print_exc()
        return False


def index_question_paper(file_path: str, classroom_id: int, resource_id: int) -> bool:
    try:
        from Backend.rag_pipeline.indexing.detector import is_handwritten
        from Backend.rag_pipeline.indexing.extractors import extract_text
        from Backend.rag_pipeline.indexing.qp_chunker import smart_chunk_question_paper

        print(f"[RAG] Processing question paper: {file_path}")
        hw = is_handwritten(file_path)
        pages = extract_text(file_path, is_handwritten=hw)

        if not pages:
            print(f"[RAG] No text extracted from {file_path}")
            return False

        extra_meta = {
            "classroom_id": classroom_id,
            "resource_id": resource_id,
            "source": file_path,
        }

        documents = smart_chunk_question_paper(pages, extra_metadata=extra_meta)

        if not documents:
            print(f"[RAG] No question chunks created")
            return False

        print(f"[RAG] Indexing {len(documents)} question chunks for classroom {classroom_id}")
        vectorstore = get_vectorstore(classroom_id)
        vectorstore.add_documents(documents)

        print(f"[RAG] Successfully indexed QP resource {resource_id}")
        return True

    except Exception as e:
        print(f"[RAG] Error indexing question paper: {e}")
        import traceback
        traceback.print_exc()
        return False


def index_question_paper_from_url(url: str, classroom_id: int, resource_id: int) -> bool:
    import tempfile
    import httpx
    try:
        response = httpx.get(url, timeout=60.0)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(response.content)
            tmp_path = tmp_file.name

        result = index_question_paper(tmp_path, classroom_id, resource_id)
        os.remove(tmp_path)
        return result

    except Exception as e:
        print(f"[RAG] Error downloading/indexing QP from URL: {e}")
        import traceback
        traceback.print_exc()
        return False


def query_resources(
    query: str,
    classroom_id: int,
    k: int = 4,
    chunk_type: str | None = None,
    answer_type: str | None = None,
    year: int | None = None,
):
    try:
        vectorstore = get_vectorstore(classroom_id)

        where: dict = {}
        if chunk_type:
            where["chunk_type"] = chunk_type
        if answer_type:
            where["answer_type"] = answer_type
        if year:
            where["year"] = year

        if where:
            results = vectorstore.similarity_search(query, k=k, filter=where)
        else:
            results = vectorstore.similarity_search(query, k=k)

        return results

    except Exception as e:
        print(f"[RAG] Error querying resources: {e}")
        return []


def delete_resource_from_vectorstore(classroom_id: int, resource_id: int):
    try:
        vectorstore = get_vectorstore(classroom_id)
        vectorstore._collection.delete(where={"resource_id": resource_id})
        print(f"[RAG] Deleted vectorstore entries for resource {resource_id} in classroom {classroom_id}")
        return True
    except Exception as e:
        print(f"[RAG] Error deleting resource {resource_id} from vectorstore: {e}")
        return False


def find_related_notes(question_text: str, classroom_id: int, k: int = 3):
    return query_resources(
        query=question_text,
        classroom_id=classroom_id,
        k=k,
        chunk_type="note",
    )


def find_similar_questions(
    query: str,
    classroom_id: int,
    k: int = 5,
    answer_type: str | None = None,
    year: int | None = None,
):
    return query_resources(
        query=query,
        classroom_id=classroom_id,
        k=k,
        chunk_type="question",
        answer_type=answer_type,
        year=year,
    )


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
    from langchain_groq import ChatGroq
    from langchain_core.messages import SystemMessage, HumanMessage

    results = query_resources(query, classroom_id)
    if not results:
        return {
            "answer": "No relevant information found in the classroom resources. Please upload some PDF resources to the classroom and wait for them to be indexed.",
            "citations": [],
            "related_questions": [],
        }

    citations = []
    seen = set()
    for doc in results:
        src = doc.metadata.get("source", "Unknown")
        if src not in seen:
            seen.add(src)
            filename = os.path.basename(src) if src != "Unknown" else "Unknown"
            page = doc.metadata.get("page")
            citations.append({"source": src, "filename": filename, "page": page})

    context = format_context(results)

    system = (
        "You are a helpful teaching assistant for a classroom. Use the following context "
        "from the classroom's PDF resources to answer the user's question.\n\n"
        "Format your responses nicely using:\n"
        "- Clear headings and subheadings when needed\n"
        "- Bullet points for lists\n"
        "- Bold text for important terms or key points\n"
        "- Numbered lists for sequential steps or rankings\n"
        "- Short paragraphs for explanations\n\n"
        "IMPORTANT — Cite your sources:\n"
        "Use numbered references like [1], [2] etc. inline in the answer where applicable.\n"
        "At the end, add a '---' separator, then a '**Sources:**' section listing each "
        "source with its number, filename, and page.\n\n"
        "Be thorough but concise. If the answer cannot be found in the context, "
        "clearly state that the information is not available.\n\n"
        "If asked questions unrelated to the classroom materials (like general knowledge, "
        "personal questions, etc.), politely say you can only help with classroom-related questions."
    )

    user_parts = [f"Context:\n{context}\n\nQuestion: {query}"]
    if conversation_history:
        history_lines = []
        for m in conversation_history:
            role = "User" if m["role"] == "user" else "Assistant"
            history_lines.append(f"{role}: {m['content']}")
        user_parts.insert(0, "Previous conversation:\n" + "\n".join(history_lines))

    messages = [SystemMessage(content=system), HumanMessage(content="\n\n".join(user_parts))]

    try:
        llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.7)
        response = llm.invoke(messages)
        answer = response.content
    except Exception as e:
        print(f"[RAG] Error generating LLM response: {e}")
        answer = f"Here is what I found in the classroom resources:\n{context}"

    related_questions = []
    try:
        related = find_similar_questions(query, classroom_id, k=3)
        for doc in related:
            related_questions.append({
                "question": doc.page_content,
                "question_number": doc.metadata.get("question_number"),
                "year": doc.metadata.get("year"),
                "exam_name": doc.metadata.get("exam_name"),
                "answer_type": doc.metadata.get("answer_type"),
            })
    except Exception as e:
        print(f"[RAG] Error fetching related PYQs: {e}")

    return {
        "answer": answer,
        "citations": citations,
        "related_questions": related_questions,
    }


def generate_conversation_title(query: str) -> str:
    try:
        from langchain_groq import ChatGroq
        from langchain_core.prompts import ChatPromptTemplate

        prompt = ChatPromptTemplate.from_messages([
            ("system", "Generate a very short title (3-6 words) for a conversation that starts with this question. Return ONLY the title, no quotes or punctuation."),
            ("user", "{query}")
        ])

        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
        )

        chain = prompt | llm
        response = chain.invoke({"query": query})
        title = response.content.strip().strip("\"'")
        return title[:60]

    except Exception as e:
        print(f"[RAG] Error generating title: {e}")
        fallback = (query[:50] + "...") if len(query) > 50 else query
        return fallback
