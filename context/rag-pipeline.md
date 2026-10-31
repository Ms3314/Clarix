# RAG Pipeline

Offline evaluation of this pipeline lives in `evals/` and is documented in [evals.md](evals.md).

There are **two code paths in the repo**. Only path A is used by the web app; path B (the LangGraph library) is now **unused by any entrypoint** (its only caller, `backend/streamlit_app.py`, was removed).

## A. Production path - `backend/rag_service.py`

### Indexing: `index_resource(file_path, classroom_id, resource_id, resource_type)`

1. `detector.is_handwritten(path)` - renders the first pages (`min(3, 5)`) with pdf2image, runs Tesseract `image_to_data`, averages positive word confidences;
   `score = (100 - avg_conf)/100`, handwritten if `> 0.3`. Falls back to 0.5 (-> handwritten) on conversion failure or when no word has confidence.
2. `extractors.extract_text(path, is_handwritten)` - PyMuPDF `page.get_text()` for text PDFs; Tesseract `image_to_string` per page (whole document rendered) for handwritten;
   each falls back to the other if it yields no pages. Output: `[{page, text, source, type: 'text'|'ocr'}]`.
3. Chunking by `resource_type`:
   - `pyq` -> `qp_chunker.smart_chunk_question_paper` (one `Document` per *question*). Regex pass: question starts like `Q1.` / `1)` / `1 `, `Section A` / `Part B` headers, marks like `(5 marks)` / `[5M]`.
     If fewer than 2 questions are found it falls back to an Ollama LLM parser over the first 6000 chars (temp 0, strips ```json fences, returns `[]` on any failure).
     Metadata: header-derived `subject, year, exam_type` (year = first `20xx` in the first 500 chars; subject = first plain-letter line among the first 6; either can be `None`),
     `chunk_type='question'`, `question_number, marks, answer_type` ('short' if marks <= 5, else 'long'; with no marks: section A -> short, other sections -> long; else 'unknown'), `section`, plus `classroom_id, resource_id, source`.
   - `notes` / `other` -> `chunker.create_langchain_documents` (500-char windows, 50 overlap; the window is cut after the last occurrence of the first separator type present in `\n\n`, `\n`, `. `, `? `, `! `, `, `).
     Metadata: `page, chunk_index, source, type`, then `classroom_id, resource_id, source, chunk_type` (`'note'` for notes, the resource type otherwise).
     Quirk (verified): the search takes the first separator *type* found anywhere in the window, even in its first 50 characters, which can yield a tiny chunk and moves the next window start backwards (e.g. `"Intro\n\n" + long text` gives a 5-char first chunk and an empty one that is filtered out).
4. `vectorstore.add_documents(documents)` - no explicit ids, so re-indexing the same file creates duplicates.
5. The upload router sets `Resource.indexed/indexed_at`. `index_resource` returns `False` (never raises) on any failure, so a failed index just leaves `indexed = false`; there is no retry/re-index endpoint.

`index_resource_from_url`, `index_question_paper`, `index_question_paper_from_url`, `find_related_notes`, `find_similar_questions` exist in `rag_service.py` but **no router calls them**.

### Vector store

`get_vectorstore(classroom_id)` -> `chromadb.CloudClient(CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE)` (tenant/database default to `"default"`) wrapped by `langchain_chroma.Chroma`,
collection name **`classroom_<invite_code>`** (invite code looked up from the DB on every call; falls back to the numeric id). Embeddings: `OllamaEmbeddings(model="nomic-embed-text-v2-moe:latest")` (hard-coded).
A new Chroma client/collection handle is built on every call (no caching).
Deleting a resource removes its vectors via `_collection.delete(where={"resource_id": id})`; deleting a classroom does not clean Chroma.

### Querying / answering

`query_resources(query, classroom_id, k=4, chunk_type?, answer_type?, year?)` -> `similarity_search` with an optional metadata `filter` (returns `[]` on any error, including Chroma/Ollama being down).
`generate_rag_response(query, classroom_id, conversation_history)`:
no hits -> canned "No relevant information found..." message; otherwise `format_context` (source, page, OCR flag, text for each hit) is stuffed into a system prompt
("helpful teaching assistant... use the context... markdown formatting... say so if the answer is not in the context... refuse unrelated questions"), prior chat turns are appended,
and `ChatOllama(model=$OLLAMA_MODEL or "qwen3.5:latest", temperature=0.7)` answers. On LLM error it returns the raw context text to the user.
The prompt does **not** ask for citations; `<think>` blocks from the model are not stripped here (they are in `quiz_ai.py`). No similarity threshold, reranker, streaming or query rewriting.
`generate_conversation_title(query)` -> 3-6 word title via the same model (temp 0.3), truncated to 60 chars, falling back to the first 50 chars of the query.

Known weakness for any citation/eval work: chunk metadata `source` is the **temporary file path** used during indexing, not the filename/URL;
`resource_id` + `page` are the reliable provenance fields (`page` is absent on `pyq` question chunks).

## B. Library path - `backend/rag_pipeline/indexing/` (LangGraph) - UNUSED

Files: `graph.py`, `pipeline.py`, `nodes.py`, `state.py`, `chroma_client.py`, `embedder.py`. No entrypoint calls them any more.
`pipeline.py` compiles a LangGraph `StateGraph(PipelineState)`: `detect -> extract -> chunk -> index -> END` (`graph.py` builds an identical second copy). `index_pdf(path)` runs it; `search_similar(query)` does a Chroma similarity search.
It indexes into a single global collection **`clarix_docs`** (hard-coded; the `collection_name` argument is ignored by the nodes) with ids `{pdf_stem}_chunk_{i}` (idempotent), only handles notes-style chunking (no PYQ), and uses
`HuggingFaceEmbeddings("all-MiniLM-L6-v2")` from `chroma_client.py` - a *different* embedding model from path A. `langchain-huggingface` is **not in requirements.txt** and is not installed in the local venv, so `chroma_client.py` would fail on import; `embedder.py` (Ollama, `nomic-embed-text-v2-moe`) is also unused.

What *is* still used from this package: `detector.py`, `extractors.py`, `chunker.py`, `qp_chunker.py` (imported by `rag_service.py`), and `extractors.py` / `chunker.py` are also imported by `evals/`.
Side effect: importing any module under `backend.rag_pipeline.indexing` first runs `backend/rag_pipeline/__init__.py` -> `indexing/__init__.py`, which imports `pipeline.py` and **compiles the LangGraph graph at import time**, so `langgraph` stays a runtime dependency of the app even though the graph is never invoked.
Older docs described this graph as the integrated pipeline; in reality `rag_service.py` re-implements the four steps inline.

## System dependencies

Tesseract OCR binary and poppler (for `pdf2image`) must be installed on the host; Ollama must be running with the chat and embedding models pulled
(`ollama pull qwen3.5`, `ollama pull nomic-embed-text-v2-moe`); Chroma Cloud credentials in `backend/.env`.
`rag_service.py` and `quiz_ai.py` call **Ollama** (chat + embeddings); the earlier Groq + HuggingFace-MiniLM implementation (last seen at commit `51f9eda`) is gone from the code, although `groq` is still installed in the local venv.
Collections built with MiniLM embeddings are incompatible with the Ollama embedding model (different vector dimensions) - re-index existing classrooms after switching.
