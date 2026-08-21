import os
import json


CHATS_FILE = "data/chats.json"
MAX_MESSAGES = 10


def load_chats():

    if not os.path.exists(CHATS_FILE):
        return {}

    try:

        with open(
            CHATS_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            return json.load(f)

    except Exception:

        return {}


def save_chats(chats):

    os.makedirs("data", exist_ok=True)

    # Keep only the last MAX_MESSAGES messages in each chat
    for chat_id in chats:

        if isinstance(chats[chat_id], list):
            chats[chat_id] = chats[chat_id][-MAX_MESSAGES:]

    with open(
        CHATS_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            chats,
            f,
            indent=2,
            ensure_ascii=False
        )
