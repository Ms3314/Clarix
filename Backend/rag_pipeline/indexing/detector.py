import os
import tempfile
from pathlib import Path
from pdf2image import convert_from_path
import pytesseract
from PIL import Image


def is_handwritten_confidence(pdf_path: str, sample_pages: int = 3) -> float:
    """
    Run OCR on a sample of pages to detect if PDF is handwritten.
    Returns confidence score (0-1): higher = more likely handwritten.
    
    Uses text density and OCR confidence metrics:
    - Low text density + low OCR confidence = likely handwritten
    - High text density + high OCR confidence = likely text-based
    """
    try:
        images = convert_from_path(pdf_path, first_page=1, last_page=min(sample_pages, 5))
    except Exception as e:
        print(f"Error converting PDF: {e}")
        return 0.5

    if not images:
        return 0.5

    total_confidence = 0
    total_pages = 0
    
    for img in images:
        gray = img.convert('L')
        text_data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)
        
        confidences = []
        text_lengths = []
        
        for i, conf in enumerate(text_data['conf']):
            if conf > 0:
                confidences.append(conf)
            if text_data['text'][i].strip():
                text_lengths.append(len(text_data['text'][i]))
        
        if confidences:
            avg_conf = sum(confidences) / len(confidences)
            total_confidence += avg_conf
            total_pages += 1
    
    if total_pages == 0:
        return 0.5
    
    avg_ocr_confidence = total_confidence / total_pages
    
    handwritten_score = max(0, min(1, (100 - avg_ocr_confidence) / 100))
    
    return handwritten_score


def is_handwritten(pdf_path: str, threshold: float = 0.3) -> bool:
    """
    Determine if PDF is handwritten based on OCR confidence threshold.
    
    Args:
        pdf_path: Path to PDF file
        threshold: Score above which is considered handwritten (default: 0.3)
    
    Returns:
        True if handwritten, False if text-based
    """
    score = is_handwritten_confidence(pdf_path)
    return score > threshold