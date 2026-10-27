# RAG Pipeline

There are **two parallel implementations**. Only the first is used by the web app.

## A. Production path — `Backend/rag_service.py`

### Indexing: `index_resource(file_path, classroom_id, resource_id, resource_type)`

1. `detector.is_handwritten(path)` — renders up to 3 pages with pdf2image, runs Tesseract `image_to_data`, averages word confidence;
   `score = (100 − avg_conf)/100`, handwritten if `> 0.3`. Falls back to 0.5 (→ handwritten) on conversion failure.
2. `extractors.extract_text(path, is_handwritten)` — PyMuPDF `page.get_text()` for text PDFs, Tesseract `image_to_string` per page for handwritten;
   each falls back to the other if it yields no pages. Output: `[{page, text, source, type: 'text'|'ocr'}]`.
3. Chunking by `resource_type`:
   - `pyq` → `qp_chunker.smart_chunk_question_paper` (one `Document` per *question*; regex on `Q1.`/`1)` starts, `Section A` headers, marks like `(5 marks)`;
     if fewer than 2 questions are found it falls back to an Ollama LLM parser over the first 6000 chars). Metadata: `subject, year, exam_type` (parsed from header),
     `chunk_type='question'`, `question_number, marks, answer_type ('short' ≤5 marks | 'long' | 'unknown'), section`, plus `classroom_id, resource_id, source`.
   - `notes` / `other` → `chunker.create_langchain_documents` (500-char windows, 50 overlap, splits at the last `\n\n`, `\n`, `. `, `? `, `! `, `, ` in the window).
     Metadata: `page, chunk_index, source, type`, then `classroom_id, resource_id, source, chunk_type` (`'note'` for notes, else the resource type).
4. `vectorstore.add_documents(documents)` — no explicit ids, so re-indexing the same file creates duplicates.
5. Router sets `Resource.indexed/indexed_at`. `index_resource` returns `False` (never raises) on any failure, so a failed index just leaves `indexed = false`.

`index_resource_from_url`, `index_question_paper(_from_url)` are helpers that **no router currently calls**.

### Vector store

`get_vectorstore(classroom_id)` → `chromadb.CloudClient(CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE)` wrapped by `langchain_chroma.Chroma`,
collection name **`classroom_<invite_code>`** (looked up from the DB on every call). Embeddings: `OllamaEmbeddings(model="nomic-embed-text-v2-moe:latest")`.
A new client/collection handle is built on every call (no caching).
Deleting a resource removes its vectors by `where={"resource_id": id}`; deleting a classroom does not clean Chroma.

### Querying / answering

`query_resources(query, classroom_id, k=4, chunk_type?, answer_type?, year?)` → `similarity_search` with an optional metadata `where` filter
(returns `[]` on any error). Convenience wrappers `find_related_notes` and `find_similar_questions` exist but are unused.
`generate_rag_response(query, classroom_id, history)`:
no hits → canned "no relevant information" message; otherwise `format_context` (source, page, OCR flag, text) is stuffed into a system prompt
("teaching assistant… use only the context… markdown formatting… refuse unrelated questions"), prior chat turns are appended,
and `ChatOllama(model=$OLLAMA_MODEL or "qwen3.5:latest", temperature=0.7)` answers. On LLM error it returns the raw context.
The prompt does **not** ask for citations and `<think>` blocks from the model are not stripped here (they are in `quiz_ai.py`).
`generate_conversation_title(query)` → 3–6 word title via the same model (temp 0.3), falling back to the first 50 chars.

Known weakness for any citation/eval work: chunk metadata `source` is the **temporary file path** used during indexing, not the filename/URL;
`resource_id` + `page` are the reliable provenance fields (`page` is absent on `pyq` question chunks).

## B. Library path — `Backend/rag_pipeline/indexing/` (LangGraph)

`graph.py`/`pipeline.py` compile a LangGraph `StateGraph(PipelineState)`: `detect → extract → chunk → index → END` (nodes in `nodes.py`; state in `state.py`).
`index_pdf(path)` runs it; `search_similar(query)` does a Chroma similarity search. It indexes into a single global collection **`clarix_docs`**
with ids `{pdf_stem}_chunk_{i}` (idempotent) using `HuggingFaceEmbeddings("all-MiniLM-L6-v2")` from `chroma_client.py` — a *different* embedding model from path A,
and `langchain-huggingface` is **not in requirements.txt**. `embedder.py` (Ollama) is unused.
Only `streamlit_app.py` imports this graph. `AGENTS.md` describes this graph as the integrated pipeline; in reality `rag_service.py`
re-implements the same four steps inline and imports only `detector`, `extractors`, `chunker`, `qp_chunker`.

## System dependencies

Tesseract OCR binary and poppler (for `pdf2image`) must be installed on the host; Ollama must be running with the chat and embedding models pulled
(`ollama pull qwen3.5`, `ollama pull nomic-embed-text-v2-moe`); Chroma Cloud credentials in `.env`.
Git state: at `HEAD` (`51f9eda`) `rag_service.py` and `quiz_ai.py` still call **Groq** (`llama-3.3-70b-versatile`) with HuggingFace MiniLM embeddings;
the move to Ollama (chat + `nomic-embed-text-v2-moe` embeddings) exists only as **uncommitted working-tree changes** in `rag_service.py`, `quiz_ai.py` and `qp_chunker.py`.
Collections built with MiniLM embeddings are incompatible with the Ollama embedding model (different vector dimensions) — re-index existing classrooms after switching.
