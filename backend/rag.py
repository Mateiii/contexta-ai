import os
import json
import numpy as np
from ollama import Client


client = Client(
    host=os.getenv(
        "OLLAMA_HOST",
        "http://localhost:11434"
    )
)

FILES_DIR = "uploads"
RAG_FILE = "data/rag.json"

EMBED_MODEL = "nomic-embed-text"
CHUNK_SIZE = 300


def create_rag():

    chunks = []

    os.makedirs("data", exist_ok=True)

    for filename in os.listdir(FILES_DIR):

        path = os.path.join(
            FILES_DIR,
            filename
        )

        if not os.path.isfile(path):
            continue

        if not filename.lower().endswith(".txt"):
            continue

        try:

            with open(
                path,
                "r",
                encoding="utf-8"
            ) as f:

                text = f.read()

        except Exception as e:

            print(
                f"Could not read {filename}: {e}"
            )

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

            if not chunk:
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


def search(question, count=3):

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
        key=lambda x: x["similarity"],
        reverse=True
    )

    return chunks[:count]