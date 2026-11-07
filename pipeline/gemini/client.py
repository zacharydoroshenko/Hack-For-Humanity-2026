"""Thin Gemini wrapper: structured JSON output + SQLite cache. Owner: Data + AI (partner)."""

from __future__ import annotations

import hashlib
import os
import sqlite3
from pathlib import Path
from typing import TypeVar

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "app.db"
PROMPTS = Path(__file__).parent / "prompts"

T = TypeVar("T", bound=BaseModel)

_client = None


def _get_client():
    global _client
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def load_prompt(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text()


def _cache_get(key: str) -> str | None:
    if not DB_PATH.exists():
        return None
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            "CREATE TABLE IF NOT EXISTS gemini_cache "
            "(input_hash TEXT PRIMARY KEY, task TEXT, output_json TEXT)"
        )
        row = db.execute(
            "SELECT output_json FROM gemini_cache WHERE input_hash = ?", (key,)
        ).fetchone()
    return row[0] if row else None


def _cache_put(key: str, task: str, output: str) -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            "CREATE TABLE IF NOT EXISTS gemini_cache "
            "(input_hash TEXT PRIMARY KEY, task TEXT, output_json TEXT)"
        )
        db.execute("INSERT OR REPLACE INTO gemini_cache VALUES (?, ?, ?)", (key, task, output))


def generate_json(prompt: str, schema: type[T], *, task: str) -> T:
    """Call Gemini with a response schema; cached by (task, model, prompt)."""
    from google.genai import types

    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    key = hashlib.sha256(f"{task}|{model}|{prompt}".encode()).hexdigest()
    if (cached := _cache_get(key)) is not None:
        return schema.model_validate_json(cached)

    resp = _get_client().models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.2,
        ),
    )
    result = schema.model_validate_json(resp.text)
    _cache_put(key, task, result.model_dump_json())
    return result


if __name__ == "__main__":
    # Smoke test:  python -m pipeline.gemini.client
    class Ping(BaseModel):
        reply: str

    print(generate_json("Reply with the word pong.", Ping, task="ping"))
