"""Runtime configuration (env flags, Witsmith data directory name)."""

from __future__ import annotations

import os

from witsmith.clod import _load_env_once


def witsmith_data_dirname() -> str:
    _load_env_once()
    return os.environ.get("WITSMITH_DIR", ".witsmith")


def mock_llm_enabled() -> bool:
    """When true, skip live CLōD calls and use deterministic demo outputs."""
    _load_env_once()
    return os.environ.get("WITSMITH_MOCK_LLM", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def confidence_ask_threshold() -> float:
    _load_env_once()
    return float(os.environ.get("WITSMITH_CONFIDENCE_ASK_BELOW", "0.7"))


def model_escalation_enabled() -> bool:
    """Escalate uncertain non-deny model checks to the strong model by default."""
    _load_env_once()
    return os.environ.get("WITSMITH_MODEL_ESCALATION", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def model_escalation_threshold() -> float:
    _load_env_once()
    return float(os.environ.get("WITSMITH_MODEL_ESCALATE_BELOW", "0.75"))
