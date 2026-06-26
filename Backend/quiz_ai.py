from groq import Groq
from dotenv import load_dotenv
import os
import json

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

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

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return json.loads(
        response.choices[0].message.content
    )