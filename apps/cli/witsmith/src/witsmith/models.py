"""Pydantic models for the wit (AGENT_WIT.yaml) and runtime payloads.

Schema is intentionally permissive — the playbook prioritises shipping
the demo path over strict validation. Tighten later if needed.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# --- Wit (the contract file) -------------------------------------------------


class Rule(BaseModel):
    pattern: Optional[str] = None
    paths: Optional[list[str]] = None
    rule: Optional[str] = None  # natural-language, LLM-interpreted at check time
    reason: Optional[str] = None


class WitNotes(BaseModel):
    framework: Optional[str] = None
    test_command: Optional[str] = None
    danger_zones: list[str] = Field(default_factory=list)


class Wit(BaseModel):
    version: int = 1
    repo: str
    notes: WitNotes = Field(default_factory=WitNotes)
    allow: list[Rule] = Field(default_factory=list)
    ask: list[Rule] = Field(default_factory=list)
    deny: list[Rule] = Field(default_factory=list)


# --- Runtime payloads --------------------------------------------------------


Decision = Literal["allow", "ask", "deny"]


class Action(BaseModel):
    command: str
    cwd: str
    session_id: Optional[str] = None
    diff: Optional[str] = None
    source: Optional[str] = None  # "user", "RECENT_NOTES.md", etc.


class CheckResult(BaseModel):
    decision: Decision
    reason: str
    dry_run: Optional[str] = None
    matched_rule: Optional[str] = None
    confidence: float = 0.0


class FailureAnalysis(BaseModel):
    cause: str
    rollback_plan: list[str]
    next_safe_action: Optional[str] = None
    handoff_note: str
    confidence: float = 0.0
