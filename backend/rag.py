import os
import json
import numpy as np
from ollama import Client
from pypdf import PdfReader
import docx

client = Client(
    host=os.getenv(
        "OLLAMA_HOST",
        "http://localhost:11434"
    )
)

FILES_DIR = "uploads"
RAG_FILE = "data/rag.json"

EMBED_MODEL = "nomic-embed-text"
CHUNK_SIZE = 50
ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".md", ".json", ".csv"}


def extract_text(filepath: str) -> str:
    """Extrage textul brut din fișier în funcție de extensia sa."""
    ext = os.path.splitext(filepath)[1].lower()
    
    try:
        # Fișiere de tip text simplu
        if ext in {".txt", ".md", ".json", ".csv"}:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

        # Fișiere PDF
        elif ext == ".pdf":
            reader = PdfReader(filepath)
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            return text

        # Fișiere Word (DOCX)
        elif ext == ".docx":
            doc = docx.Document(filepath)
            return "\n".join([p.text for p in doc.paragraphs])

    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return ""

    return ""


def create_rag():

    chunks = []

    os.makedirs("data", exist_ok=True)

    if not os.path.exists(FILES_DIR):
        os.makedirs(FILES_DIR, exist_ok=True)

    for filename in os.listdir(FILES_DIR):

        path = os.path.join(
            FILES_DIR,
            filename
        )

        if not os.path.isfile(path):
            continue

        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            continue

        # Extrage textul indiferent de format
        text = extract_text(path)

        if not text or not text.strip():
            continue

        words = text.split()

        for i in range(
            0,
            len(words),
            CHUNK_SIZE
        ):

            chunk = " ".join(
                words[
                    i:i + CHUNK_SIZE
                ]
            )

            if not chunk.strip():
                continue

            result = client.embed(
                model=EMBED_MODEL,
                input=chunk
            )

            embedding = result[
                "embeddings"
            ][0]

            chunks.append({
                "file": filename,
                "text": chunk,
                "embedding": embedding
            })

    with open(
        RAG_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            chunks,
            f,
            indent=2,
            ensure_ascii=False
        )

    print(
        f"RAG created with {len(chunks)} chunks."
    )


def search(question, count=1):

    if not os.path.exists(RAG_FILE):
        return []

    with open(
        RAG_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        chunks = json.load(f)

    if not chunks:
        return []

    question_embedding = np.array(
        client.embed(
            model=EMBED_MODEL,
            input=question
        )["embeddings"][0]
    )

    for chunk in chunks:

        embedding = np.array(
            chunk["embedding"]
        )

        denominator = (
            np.linalg.norm(question_embedding)
            * np.linalg.norm(embedding)
        )

        if denominator == 0:
            chunk["similarity"] = 0
            continue

        chunk["similarity"] = (
            np.dot(
                question_embedding,
                embedding
            )
            / denominator
        )

    chunks.sort(
        key=lambda x: float(x["similarity"]),
        reverse=True
    )

    return chunks[:count]