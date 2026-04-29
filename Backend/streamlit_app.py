import streamlit as st
import os
import tempfile
from pathlib import Path
from dotenv import load_dotenv
from rag_pipeline.indexing.pipeline import index_pdf, search_similar

load_dotenv()

def get_openai_client():
    from openai import OpenAI
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def retrieve_and_answer(query: str, n_results: int = 5) -> str:
    """Retrieves relevant documents and uses OpenAI to answer the question."""
    client = get_openai_client()
    
    results = search_similar(query, n_results=n_results)
    docs = results.get("documents", [])
    metadatas = results.get("metadatas", [])
    
    if not docs:
        return "No relevant documents found to answer your question."
    
    context = "\n\n".join([f"Document {i+1}:\n{doc}" for i, doc in enumerate(docs)])
    
    prompt = f"""You are a helpful assistant. Based only on the provided context documents, answer the user's question.

Context:
{context}

Question: {query}

Instructions: If the answer is not in the context, say "I don't have enough information to answer that question based on the uploaded documents." Otherwise, provide a clear answer based on the context.

Answer:"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    
    return response.choices[0].message.content

st.title("RAG Pipeline Testing UI")

if "messages" not in st.session_state:
    st.session_state.messages = []

with st.sidebar:
    st.header("Index PDF")
    uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")
    
    if uploaded_file is not None:
        if st.button("Index PDF"):
            with st.spinner("Indexing PDF..."):
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                    tmp_file.write(uploaded_file.getvalue())
                    tmp_path = tmp_file.name
                
                try:
                    result = index_pdf(tmp_path)
                    st.success(f"Indexed: {result.get('success')}")
                    if result.get("success"):
                        st.json(result)
                    else:
                        st.error(result.get("message", "Error"))
                except Exception as e:
                    st.error(f"Error: {str(e)}")
                finally:
                    os.unlink(tmp_path)

    st.divider()
    st.subheader("Pipeline Logs")
    st.caption("Check terminal for detailed logs")

col1, col2 = st.columns([2, 1])

with col1:
    st.header("Chat")
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    if prompt := st.chat_input("Ask a question about your documents"):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)
        
        with st.spinner("Searching and generating answer..."):
            try:
                response = retrieve_and_answer(prompt)
            except Exception as e:
                response = f"Error: {str(e)}"
        
        st.session_state.messages.append({"role": "assistant", "content": response})
        with st.chat_message("assistant"):
            st.markdown(response)

with col2:
    st.header("Retrieved Docs")
    if "messages" in st.session_state and st.session_state.messages:
        last_response = st.session_state.messages[-1]
        if last_response["role"] == "assistant":
            st.markdown(last_response["content"][:2000])