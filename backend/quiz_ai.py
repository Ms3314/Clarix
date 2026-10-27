from langchain_ollama import ChatOllama
from dotenv import load_dotenv
import os
import json

load_dotenv()

_llm = None

def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatOllama(model=os.getenv("OLLAMA_MODEL", "qwen3.5:latest"), temperature=0.7)
    return _llm

def generate_quiz(topic: str, difficulty: str, num_questions: int):

    prompt = f"""
Generate {num_questions} MCQ questions on {topic}.

Difficulty: {difficulty}

Return ONLY valid JSON.

Format:

[
  {{
    "question": "Question text",
    "options": ["A","B","C","D"],
    "correct_answer": 0
  }}
]
"""

    response = _get_llm().invoke(prompt)

    content = response.content
    if "<think>" in content:
        content = content.split("</think>")[-1].strip()

    return json.loads(content)