"""Append-only JSONL replay log under `.witsmith/log.jsonl`."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def new_action_id() -> str:
    return uuid.uuid4().hex[:12]


def log_path(repo_root: Path, dirname: str) -> Path:
    return repo_root / dirname / "log.jsonl"


def log_size(repo_root: Path, dirname: str) -> int:
    path = log_path(repo_root, dirname)
    if not path.is_file():
        return 0
    return path.stat().st_size


def append_event(repo_root: Path, dirname: str, event: dict[str, Any]) -> None:
    path = log_path(repo_root, dirname)
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(event, ensure_ascii=False) + "\n"
    with path.open("a", encoding="utf-8") as f:
        f.write(line)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_event_by_action_id(
    repo_root: Path, dirname: str, action_id: str
) -> dict[str, Any] | None:
    path = log_path(repo_root, dirname)
    if not path.is_file():
        return None
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("action_id") == action_id:
                return obj
    return None


def read_events_from_offset(repo_root: Path, dirname: str, offset: int = 0) -> list[dict[str, Any]]:
    path = log_path(repo_root, dirname)
    if not path.is_file():
        return []
    events: list[dict[str, Any]] = []
    safe_offset = max(0, min(offset, path.stat().st_size))
    with path.open("rb") as f:
        f.seek(safe_offset)
        for raw in f:
            try:
                line = raw.decode("utf-8").strip()
            except UnicodeDecodeError:
                continue
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                events.append(obj)
    return events


def iter_events_for_session(
    repo_root: Path, dirname: str, session_id: str
) -> list[dict[str, Any]]:
    path = log_path(repo_root, dirname)
    if not path.is_file():
        return []
    events: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("session_id") == session_id or obj.get("sessionId") == session_id:
                events.append(obj)
    return events


def read_last_deny(repo_root: Path, dirname: str) -> dict[str, Any] | None:
    path = log_path(repo_root, dirname)
    if not path.is_file():
        return None
    last: dict[str, Any] | None = None
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("decision") == "deny":
                last = obj
    return last
