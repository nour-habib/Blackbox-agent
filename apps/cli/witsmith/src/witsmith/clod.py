"""CLōD client wrapper.

CLōD is an OpenRouter-style aggregator. It exposes an OpenAI-compatible
endpoint (`/v1/chat/completions`), so we use the OpenAI SDK and pass
`base_url=https://api.clod.io/v1`. The SDK is happy as long as the route
returns the OpenAI chat-completions schema, which CLōD does for every
model in its catalog (Claude, GPT, Qwen, etc.).

CLōD's available Anthropic models (as of 2026-05):
  claude-opus-4-5, claude-opus-4-0,
  claude-sonnet-4-5, claude-sonnet-4-0,
  claude-haiku-4-5

Note: claude-sonnet-4-6 exists on Anthropic's direct API but NOT on CLōD,
so we default to claude-sonnet-4-5.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

DEFAULT_MODEL = "gpt-oss-120b"  # free-tier; swap via WITSMITH_MODEL in .env
DEFAULT_STRONG_MODEL = "claude-sonnet-4-5"
DEFAULT_BASE_URL = "https://api.clod.io/v1"


def _resolve_dotenv_path() -> str | None:
    """Find `.env` next to `pyproject.toml` so scripts work from any cwd."""
    here = Path(__file__).resolve().parent
    for directory in (here, *here.parents):
        root_marker = directory / "pyproject.toml"
        env_file = directory / ".env"
        if env_file.is_file():
            return str(env_file)
        if root_marker.is_file():
            break
    return None


def _load_env_once() -> None:
    # Idempotent: dotenv won't overwrite real env vars by default.
    path = _resolve_dotenv_path()
    if path:
        load_dotenv(path)
    else:
        load_dotenv()


@lru_cache(maxsize=1)
def client() -> OpenAI:
    """Return a process-wide OpenAI client pointed at CLōD."""
    _load_env_once()
    api_key = os.environ.get("CLOD_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "CLOD_API_KEY (or OPENAI_API_KEY) is not set. "
            "Copy .env.example to .env and fill it in."
        )
    base_url = (
        os.environ.get("CLOD_BASE_URL")
        or os.environ.get("OPENAI_BASE_URL")
        or DEFAULT_BASE_URL
    )
    return OpenAI(api_key=api_key, base_url=base_url)


def model() -> str:
    """The default model name used by every Witsmith LLM call."""
    _load_env_once()
    return os.environ.get("WITSMITH_MODEL", DEFAULT_MODEL)


def check_model() -> str:
    """Cheap/default model for first-pass permission checks."""
    _load_env_once()
    return os.environ.get("WITSMITH_CHECK_MODEL") or model()


def strong_model() -> str:
    """Escalation model for uncertain high-risk checks."""
    _load_env_once()
    return os.environ.get("WITSMITH_STRONG_MODEL", DEFAULT_STRONG_MODEL)


def amend_model() -> str:
    """Policy-changing amendment model; defaults to the strong model."""
    _load_env_once()
    return os.environ.get("WITSMITH_AMEND_MODEL") or strong_model()
