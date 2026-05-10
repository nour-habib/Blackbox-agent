"""Small EvidenceBundle compression helpers for amendment prompts."""

from __future__ import annotations

import re
from typing import Iterable

from witsmith.contracts import EvidenceBundle

_ERROR_MARKERS = re.compile(r"(error|failed|exception|traceback|expected)", re.I)


def fold_diff(diff: str, *, max_lines: int = 160) -> str:
    """Keep file/hunk headers and changed lines; cap the prompt-sized excerpt."""
    if not diff:
        return ""
    kept: list[str] = []
    for line in diff.splitlines():
        if (
            line.startswith("diff --git")
            or line.startswith("--- ")
            or line.startswith("+++ ")
            or line.startswith("@@")
            or line.startswith("+")
            or line.startswith("-")
        ):
            kept.append(line)
        if len(kept) >= max_lines:
            kept.append(f"... diff folded after {max_lines} relevant lines")
            break
    return "\n".join(kept)


def last_error_excerpt(text: str, *, context: int = 12, max_chars: int = 4000) -> str:
    """Return a compact slice around the last useful error marker."""
    if not text:
        return ""
    lines = text.splitlines()
    marker_index = None
    for idx, line in enumerate(lines):
        if _ERROR_MARKERS.search(line):
            marker_index = idx
    if marker_index is None:
        return text[-max_chars:]
    start = max(0, marker_index - context)
    end = min(len(lines), marker_index + context + 1)
    return "\n".join(lines[start:end])[-max_chars:]


def bundle_evidence(bundle: EvidenceBundle, *, max_items: int = 8) -> list[str]:
    """Derive short evidence strings suitable for ContractAmendment.evidence."""
    evidence: list[str] = []
    if bundle.changedFiles:
        evidence.append("changed files: " + ", ".join(bundle.changedFiles[:8]))
    if bundle.diff:
        excerpt = fold_diff(bundle.diff, max_lines=40)
        if excerpt:
            evidence.append("diff excerpt:\n" + excerpt)

    for command in bundle.commands:
        if len(evidence) >= max_items:
            break
        if command.exitCode not in (None, 0):
            excerpt = last_error_excerpt(command.output)
            detail = f"command failed ({command.exitCode}): {command.command}"
            if excerpt:
                detail += "\n" + excerpt
            evidence.append(detail)

    return _trim_items(evidence, max_items=max_items)


def _trim_items(items: Iterable[str], *, max_items: int, max_chars: int = 1200) -> list[str]:
    trimmed: list[str] = []
    for item in items:
        text = item.strip()
        if len(text) > max_chars:
            text = text[: max_chars - 3] + "..."
        if text:
            trimmed.append(text)
        if len(trimmed) >= max_items:
            break
    return trimmed
