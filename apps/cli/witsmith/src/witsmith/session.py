"""Session recorder lifecycle for the Witsmith CLI."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from witsmith.config import witsmith_data_dirname
from witsmith.layout import WIT_FILENAME, find_wit_file
from witsmith.replay import log_size, read_events_from_offset, utc_now_iso

CONFIG = {
    "version": 1,
    "contextFile": ".witsmith/context.md",
    "logFile": ".witsmith/log.jsonl",
    "sessionsDir": ".witsmith/sessions",
}

CURSOR_RULE = """---
description: Witsmith agent trace rule for active debugging sessions
globs:
  - "**/*"
alwaysApply: true
---

# Witsmith Agent Trace Rule

If `.witsmith/active-session.json` exists, maintain `.witsmith/agent-trace.md`.

If `.witsmith/active-session.json` does not exist, ignore this rule.

When tracing, log concise observable summaries only. Do not include private chain-of-thought.

Record:
- files inspected
- files changed
- commands run
- assumptions made
- errors encountered
- final summary

Use evidence. Do not guess.
"""

STARTER_WIT = """version: 1
repo: witsmith-project
notes:
  test_command: "npm test"
  danger_zones:
    - "destructive filesystem commands"
    - "database migrations"

allow:
  - pattern: "npm test"

ask:
  - pattern: "*prisma migrate*"

deny:
  - pattern: "git push --force*"
  - pattern: "DROP TABLE*"
  - pattern: "rm -rf*"
"""


def data_dir(repo_root: Path) -> Path:
    return repo_root / witsmith_data_dirname()


def resolve_repo_root(cwd: str, *, require_existing: bool = False) -> Path:
    start = Path(cwd).expanduser().resolve()
    wit_path = find_wit_file(start)
    if wit_path is not None:
        return wit_path.parent.resolve()

    dirname = witsmith_data_dirname()
    for directory in [start, *start.parents]:
        if (directory / dirname).is_dir():
            return directory.resolve()

    if require_existing:
        raise RuntimeError(
            "witsmith: no AGENT_WIT.yaml or .witsmith directory found; run `witsmith init` first."
        )
    return start


def cmd_init(cwd: str) -> int:
    repo_root = resolve_repo_root(cwd)
    wdir = data_dir(repo_root)
    created: list[str] = []

    for rel in ("", "sessions", "handoffs"):
        path = wdir / rel
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            created.append(str(path.relative_to(repo_root)))

    config_path = wdir / "config.json"
    if not config_path.exists():
        config_path.write_text(json.dumps(CONFIG, indent=2) + "\n", encoding="utf-8")
        created.append(str(config_path.relative_to(repo_root)))

    cursor_rule = repo_root / ".cursor" / "rules" / "witsmith-memory.mdc"
    if not cursor_rule.exists():
        cursor_rule.parent.mkdir(parents=True, exist_ok=True)
        cursor_rule.write_text(CURSOR_RULE, encoding="utf-8")
        created.append(str(cursor_rule.relative_to(repo_root)))

    wit_path = repo_root / WIT_FILENAME
    if not wit_path.exists():
        wit_path.write_text(STARTER_WIT, encoding="utf-8")
        created.append(WIT_FILENAME)

    if created:
        print(f"witsmith init: created {', '.join(created)}")
    else:
        print("witsmith init: runtime files already present")
    return 0


def cmd_start(task: str, cwd: str) -> int:
    task = task.strip()
    if not task:
        print("witsmith start: task cannot be empty")
        return 2

    try:
        repo_root = resolve_repo_root(cwd, require_existing=True)
    except RuntimeError as e:
        print(str(e))
        return 3

    wdir = data_dir(repo_root)
    active_path = wdir / "active-session.json"
    if active_path.exists():
        print(f"witsmith start: active session already exists at {active_path}")
        return 4

    wdir.mkdir(parents=True, exist_ok=True)
    session_id = f"session_{int(time.time() * 1000)}"
    session = {
        "id": session_id,
        "task": task,
        "repoPath": str(repo_root),
        "branch": _git(repo_root, "rev-parse", "--abbrev-ref", "HEAD") or "unknown",
        "baseCommit": _git(repo_root, "rev-parse", "HEAD") or "unknown",
        "startedAt": utc_now_iso(),
        "status": "active",
        "logStartOffset": log_size(repo_root, witsmith_data_dirname()),
    }

    active_path.write_text(json.dumps(session, indent=2) + "\n", encoding="utf-8")
    trace_path = wdir / "agent-trace.md"
    trace_path.write_text(_trace_template(session_id, task), encoding="utf-8")
    print(f"witsmith start: started {session_id}")
    return 0


def cmd_finish(cwd: str) -> int:
    try:
        repo_root = resolve_repo_root(cwd, require_existing=True)
    except RuntimeError as e:
        print(str(e))
        return 3

    wdir = data_dir(repo_root)
    active_path = wdir / "active-session.json"
    if not active_path.exists():
        print("witsmith finish: no active session found")
        return 4

    try:
        active = json.loads(active_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print(f"witsmith finish: invalid JSON in {active_path}")
        return 5

    trace_path = wdir / "agent-trace.md"
    agent_trace = trace_path.read_text(encoding="utf-8") if trace_path.exists() else ""
    offset = int(active.get("logStartOffset") or 0)
    actions = read_events_from_offset(repo_root, witsmith_data_dirname(), offset)
    changed_files = _git_lines(repo_root, "diff", "--name-only")
    diff = _git(repo_root, "diff") or ""
    finished_at = utc_now_iso()

    evidence = {
        "id": active.get("id"),
        "task": active.get("task", ""),
        "repoPath": active.get("repoPath", str(repo_root)),
        "branch": active.get("branch", "unknown"),
        "baseCommit": active.get("baseCommit", "unknown"),
        "endCommit": _git(repo_root, "rev-parse", "HEAD") or "unknown",
        "startedAt": active.get("startedAt"),
        "finishedAt": finished_at,
        "status": "finished",
        "changedFiles": changed_files,
        "diff": diff,
        "actions": actions,
        "agentTrace": agent_trace,
    }
    bundle = {
        "evidenceBundle": evidence,
        "report": _build_report(evidence, finished_at),
    }

    sessions_dir = wdir / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    session_path = sessions_dir / f"{active.get('id')}.json"
    if session_path.exists():
        print(f"witsmith finish: session file already exists at {session_path}")
        return 6

    session_path.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    active_path.unlink()
    print(f"witsmith finish: wrote {session_path}")
    return 0


def cmd_context(task: str, cwd: str) -> int:
    try:
        repo_root = resolve_repo_root(cwd, require_existing=True)
    except RuntimeError as e:
        print(str(e))
        return 3

    task = task.strip()
    if not task:
        print("witsmith context: task cannot be empty")
        return 2

    memories = _read_memory_cards(data_dir(repo_root) / "sessions")
    scored = sorted(
        ((score, memory) for memory in memories if (score := _score_memory(task, memory)) > 0),
        key=lambda item: item[0],
        reverse=True,
    )[:3]

    lines = ["# Witsmith Context", "", f"Task: {task}", "", "## Relevant Memories", ""]
    if scored:
        for _, memory in scored:
            lines.append(f"- {memory.get('content', '').strip()}")
    else:
        lines.append("- No relevant memories found.")

    context = "\n".join(lines) + "\n"
    context_path = data_dir(repo_root) / "context.md"
    context_path.parent.mkdir(parents=True, exist_ok=True)
    context_path.write_text(context, encoding="utf-8")
    print(context, end="")
    print(f"\nwitsmith context: wrote {context_path}")
    return 0


def cmd_stale_check(cwd: str) -> int:
    try:
        repo_root = resolve_repo_root(cwd, require_existing=True)
    except RuntimeError as e:
        print(str(e))
        return 3

    count = len(_read_memory_cards(data_dir(repo_root) / "sessions", include_stale=True))
    print(
        f"Stale-check placeholder: found {count} memory cards. "
        "Hash-based stale detection will be added later."
    )
    return 0


def cmd_clean(cwd: str, *, yes: bool = False, sessions: bool = False, clean_all: bool = False) -> int:
    try:
        repo_root = resolve_repo_root(cwd, require_existing=True)
    except RuntimeError as e:
        print(str(e))
        return 3

    targets = _clean_targets(repo_root, sessions=sessions, clean_all=clean_all)
    existing = [path for path in targets if path.exists()]
    if not existing:
        print("witsmith clean: nothing to clean")
        return 0

    active_path = data_dir(repo_root) / "active-session.json"
    if active_path.exists() and any(active_path == path or active_path.is_relative_to(path) for path in existing):
        print("witsmith clean: warning: active session state will be removed")

    action = "removing" if yes else "would remove"
    for path in existing:
        print(f"witsmith clean: {action} {_rel(path, repo_root)}")

    if not yes:
        print("witsmith clean: dry run only; pass --yes to delete")
        return 0

    for path in existing:
        if not _is_under(path, repo_root):
            print(f"witsmith clean: refusing to remove path outside repo root: {path}")
            return 5
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
    return 0


def _clean_targets(repo_root: Path, *, sessions: bool, clean_all: bool) -> list[Path]:
    wdir = data_dir(repo_root)
    if clean_all:
        return [wdir, repo_root / ".cursor" / "rules" / "witsmith-memory.mdc"]

    targets = [
        wdir / "active-session.json",
        wdir / "agent-trace.md",
        wdir / "context.md",
        wdir / "log.jsonl",
        wdir / "cache.sqlite",
        wdir / "cache.sqlite-journal",
    ]
    if sessions:
        targets.append(wdir / "sessions")
    return targets


def _is_under(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


def _rel(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def _trace_template(session_id: str, task: str) -> str:
    return f"""# Witsmith Agent Trace

## Session
- ID: {session_id}
- Task: {task}

## Files inspected
-

## Files changed
-

## Commands run
-

## Assumptions
-

## Errors encountered
-

## Final summary
-
"""


def _git(repo_root: Path, *args: str) -> str | None:
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout.strip()


def _git_lines(repo_root: Path, *args: str) -> list[str]:
    out = _git(repo_root, *args)
    if not out:
        return []
    return [line for line in out.splitlines() if line.strip()]


def _build_report(evidence: dict[str, Any], created_at: str) -> dict[str, Any]:
    actions = evidence.get("actions", [])
    changed_files = evidence.get("changedFiles", [])
    failed = [a for a in actions if a.get("executed") and a.get("exit_code") not in (0, None)]
    denied = [a for a in actions if a.get("decision") == "deny"]
    task = str(evidence.get("task", ""))

    observed = [
        f"Task was: {task}",
        f"Changed files count: {len(changed_files)}",
        f"Witsmith recorded {len(actions)} actions",
        f"{len(failed)} actions failed",
        f"{len(denied)} actions were denied",
    ]
    observed.extend(f"Changed file: {path}" for path in changed_files)

    hypotheses: list[str] = []
    if failed:
        hypotheses.append("The session may have involved a failed implementation before the final result.")
    if failed and len(actions) > len(failed):
        hypotheses.append("The agent appears to have adjusted behavior after a failed command.")
    if denied:
        hypotheses.append("The session likely included at least one action that Witsmith considered unsafe.")

    summary = (
        f"Session for '{task}' changed {len(changed_files)} files, recorded {len(actions)} "
        f"actions, had {len(failed)} failed actions, and had {len(denied)} denied actions."
    )
    memory_cards = _memory_cards(evidence, failed, created_at)
    return {
        "summary": summary,
        "observedFacts": observed,
        "agentReportedClaims": _agent_claims(str(evidence.get("agentTrace", ""))),
        "inferredHypotheses": hypotheses,
        "memoryCards": memory_cards,
    }


def _agent_claims(trace: str) -> list[str]:
    claims: list[str] = []
    for line in trace.splitlines():
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue
        claim = stripped[2:].strip()
        if claim:
            claims.append(f"Agent reported: {claim}")
    return claims


def _memory_cards(
    evidence: dict[str, Any], failed: list[dict[str, Any]], created_at: str
) -> list[dict[str, Any]]:
    changed_files = evidence.get("changedFiles", [])
    if not changed_files and not failed:
        return []

    task = str(evidence.get("task", ""))
    session_id = str(evidence.get("id", ""))
    failed_commands = [str(a.get("command", "")).strip() for a in failed if a.get("command")]
    file_summary = ", ".join(changed_files[:3]) if changed_files else "no files"
    if len(changed_files) > 3:
        file_summary += f", and {len(changed_files) - 3} more"

    evidence_lines = [f"Changed files: {', '.join(changed_files) or 'none'}"]
    if failed_commands:
        evidence_lines.append(f"Failed actions: {', '.join(failed_commands)}")

    return [
        {
            "id": f"memory_{int(time.time() * 1000)}",
            "sessionId": session_id,
            "type": "episodic",
            "claimType": "observed",
            "content": (
                f"Previous session for '{task}' changed {file_summary} "
                f"and had {len(failed)} failed actions."
            ),
            "evidence": evidence_lines,
            "sourceFiles": changed_files,
            "confidence": "medium",
            "retrieveWhen": _keywords([task, *changed_files]),
            "staleIfChanged": changed_files,
            "isStale": False,
            "createdAt": created_at,
        }
    ]


def _keywords(values: list[str]) -> list[str]:
    words: set[str] = set()
    for value in values:
        for word in re.findall(r"[a-z0-9]+", value.lower()):
            if len(word) >= 3:
                words.add(word)
    return sorted(words)


def _read_memory_cards(sessions_dir: Path, *, include_stale: bool = False) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    if not sessions_dir.is_dir():
        return cards
    for path in sorted(sessions_dir.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        memories = payload.get("report", {}).get("memoryCards", [])
        if not isinstance(memories, list):
            continue
        for memory in memories:
            if not isinstance(memory, dict):
                continue
            if memory.get("isStale") and not include_stale:
                continue
            cards.append(memory)
    return cards


def _score_memory(task: str, memory: dict[str, Any]) -> int:
    task_words = set(_keywords([task]))
    haystack = " ".join(
        [
            str(memory.get("content", "")),
            " ".join(str(item) for item in memory.get("retrieveWhen", [])),
        ]
    )
    memory_words = set(_keywords([haystack]))
    return len(task_words & memory_words)
