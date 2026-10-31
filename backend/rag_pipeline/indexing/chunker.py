from typing import List
from langchain_core.documents import Document


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    if not text or len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = start + chunk_size

        if end >= text_length:
            chunks.append(text[start:])
            break

        chunk = text[start:end]

        for sep in ['\n\n', '\n', '. ', '? ', '! ', ', ']:
            last_sep = chunk.rfind(sep)
            if last_sep != -1:
                end = start + last_sep + len(sep)
                break

        chunks.append(text[start:end].strip())
        start = end - overlap

    return chunks


def chunk_pages(pages: List[dict], chunk_size: int = 500, overlap: int = 50) -> List[dict]:
    results = []

    for page_data in pages:
        text = page_data['text']
        chunks = chunk_text(text, chunk_size, overlap)

        for chunk_idx, chunk in enumerate(chunks):
            if chunk.strip():
                results.append({
                    'text': chunk.strip(),
                    'page': page_data['page'],
                    'chunk_index': chunk_idx,
                    'source': page_data['source'],
                    'type': page_data['type']
                })

    return results


def create_langchain_documents(pages: List[dict]) -> List[Document]:
    results = []

    for page_data in pages:
        text = page_data['text']
        chunks = chunk_text(text)

        for chunk_idx, chunk in enumerate(chunks):
            if chunk.strip():
                results.append(Document(
                    page_content=chunk.strip(),
                    metadata={
                        'page': page_data['page'],
                        'chunk_index': chunk_idx,
                        'source': page_data['source'],
                        'type': page_data['type']
                    }
                ))

    return results