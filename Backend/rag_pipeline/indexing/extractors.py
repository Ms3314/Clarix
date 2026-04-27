import io
import os
import tempfile
from pathlib import Path
from typing import List
import fitz
from pdf2image import convert_from_path
import pytesseract
from PIL import Image


def extract_text_from_pdf(pdf_path: str) -> List[dict]:
    """
    Extract text from a text-based PDF using PyMuPDF.
    
    Returns list of dicts with 'page', 'text', 'metadata'.
    """
    results = []
    doc = fitz.open(pdf_path)
    
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text()
        if text.strip():
            results.append({
                'page': page_num,
                'text': text.strip(),
                'source': pdf_path,
                'type': 'text'
            })
    
    doc.close()
    return results


def extract_text_with_ocr(pdf_path: str) -> List[dict]:
    """
    Extract text from handwritten PDF using OCR (Tesseract).
    
    Returns list of dicts with 'page', 'text', 'metadata'.
    """
    results = []
    images = convert_from_path(pdf_path)
    
    for page_num, img in enumerate(images, start=1):
        gray = img.convert('L')
        text = pytesseract.image_to_string(gray)
        
        if text.strip():
            results.append({
                'page': page_num,
                'text': text.strip(),
                'source': pdf_path,
                'type': 'ocr'
            })
    
    return results


def extract_text(pdf_path: str, is_handwritten: bool = False) -> List[dict]:
    """
    Extract text from PDF based on type.
    
    Args:
        pdf_path: Path to PDF file
        is_handwritten: If True, use OCR; else use direct text extraction
    
    Returns:
        List of dicts with 'page', 'text', 'source', 'type'
    """
    if is_handwritten:
        return extract_text_with_ocr(pdf_path)
    else:
        return extract_text_from_pdf(pdf_path)