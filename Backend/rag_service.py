import os
from pathlib import Path

CHROMA_API_KEY = os.getenv("CHROMA_API_KEY", "ck-MhyiZedTYrWhSo3ZLxN23L67DmuRFvhgPVrSViveePZ")
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

def index_resource_from_url(url: str, classroom_id: int, resource_id: int) -> bool:
    import tempfile
    import httpx
    try:
        from langchain_community.document_loaders import PyPDFLoader
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        response = httpx.get(url, timeout=60.0)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(response.content)
            tmp_path = tmp_file.name

        loader = PyPDFLoader(tmp_path)
        documents = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )
        chunks = text_splitter.split_documents(documents)

        for chunk in chunks:
            chunk.metadata["classroom_id"] = classroom_id
            chunk.metadata["resource_id"] = resource_id

        vectorstore = get_chroma_client(classroom_id)
        vectorstore.add_documents(chunks)

        os.remove(tmp_path)
        return True
    except Exception as e:
        print(f"Error indexing resource from URL: {e}")
        return False

def index_resource(file_path: str, classroom_id: int, resource_id: int) -> bool:
    try:
        from langchain_community.document_loaders import PyPDFLoader
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from langchain_core.documents import Document

        loader = PyPDFLoader(file_path)
        documents = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
        )
        chunks = text_splitter.split_documents(documents)

        for chunk in chunks:
            chunk.metadata["classroom_id"] = classroom_id
            chunk.metadata["resource_id"] = resource_id

        vectorstore = get_chroma_client(classroom_id)
        vectorstore.add_documents(chunks)

        return True
    except Exception as e:
        print(f"Error indexing resource: {e}")
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
        print(f"Error querying resources: {e}")
        return []

def format_context(results):
    context = ""
    for i, doc in enumerate(results, 1):
        context += f"\n--- Document {i} ---\n"
        context += f"Source: {doc.metadata.get('source', 'Unknown')}\n"
        context += doc.page_content + "\n"
    return context

def generate_rag_response(query: str, classroom_id: int):
    results = query_resources(query, classroom_id)
    if not results:
        return "No relevant information found in the classroom resources. Please upload some PDF resources to the classroom and wait for them to be indexed."

    context = format_context(results)

    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.prompts import ChatPromptTemplate
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a helpful teaching assistant for a classroom. Use the following context from the classroom's PDF resources to answer the user's question. 

Be thorough but concise. If the answer cannot be found in the context provided, clearly state that the information is not available in the uploaded resources.
, if you are asked any questions other than the classroom related questions then ignore and say that i can answer only the classroom related questions. and if the context is empty or not relevant to the question then say that i can answer only the classroom related questions.

Context:
{context}"""),
            ("user", "{query}")
        ])
        
        llm = ChatOpenAI(
            model="gpt-5.4-nano",
            temperature=0.7,
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        chain = prompt | llm
        response = chain.invoke({"context": context, "query": query})
        
        return response.content
    except Exception as e:
        print(f"Error generating LLM response: {e}")
        return f"I found relevant information but encountered an error generating the response. Here's what I found:\n\n{context}\n\nPlease refer to the documents above for the answer."
