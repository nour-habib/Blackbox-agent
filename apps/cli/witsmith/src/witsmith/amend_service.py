"""Propose YAML amendments after a recorded deny (mock or LLM)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from witsmith.clod import amend_model, client
from witsmith.config import mock_llm_enabled
from witsmith.contracts import ContractAmendment, EvidenceBundle, to_contract_amendment
from witsmith.evidence import bundle_evidence
from witsmith.models import Rule
from witsmith.wit_file import load_wit


def mock_amendment_diff(wit_yaml: str, log_event: dict[str, Any]) -> str:
    """Unified-diff style snippet for the demo wow moment."""
    _ = wit_yaml  # reserved if we later anchor on real line numbers
    src = log_event.get("source") or "repo file"
    return (
        "--- AGENT_WIT.yaml\n"
        "+++ AGENT_WIT.yaml\n"
        "@@ deny @@\n"
        "   - rule: \"shell commands originating from non-prompt sources...\"\n"
        "+  - paths: [\"**/RECENT_NOTES.md\", \"**/NOTES.md\"]\n"
        f"+    reason: \"auto-amended after prompt-injection attempt ({src})\"\n"
        "+    # see .witsmith/handoffs for the Self-Rescue note\n"
    )


def live_amendment_diff(wit_yaml: str, log_event: dict[str, Any]) -> str:
    selected_model = amend_model()
    system_prompt = (
        "You amend AGENT_WIT.yaml after a security deny. Return JSON only with key "
        "`unified_diff` whose value is a Git-style unified diff patch for the wit file "
        "(minimal change, valid YAML). No markdown fences."
    )
    wit_payload = json.dumps({"wit_yaml": wit_yaml[:16000]}, ensure_ascii=False)
    event_payload = json.dumps({"log_event": log_event}, ensure_ascii=False)
    resp = client().chat.completions.create(
        model=selected_model,
        temperature=0.1,
        max_tokens=900,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": wit_payload},
            {"role": "user", "content": event_payload},
        ],
        response_format={"type": "json_object"},
    )
    raw = (resp.choices[0].message.content or "").strip()
    data = json.loads(raw)
    return str(data.get("unified_diff", "")).strip() or mock_amendment_diff(wit_yaml, log_event)


def propose_amendment_diff(wit_yaml: str, log_event: dict[str, Any]) -> str:
    if mock_llm_enabled():
        return mock_amendment_diff(wit_yaml, log_event)
    try:
        return live_amendment_diff(wit_yaml, log_event)
    except Exception:
        return mock_amendment_diff(wit_yaml, log_event)


def propose_contract_amendment(
    wit_path: Path,
    log_event: dict[str, Any],
    *,
    evidence: list[str] | None = None,
    evidence_bundle: EvidenceBundle | None = None,
    session_id: str | None = None,
) -> ContractAmendment:
    """Return and persist the team-facing ContractAmendment wrapper."""
    yml = wit_path.read_text(encoding="utf-8")
    diff = propose_amendment_diff(yml, log_event)
    session = (
        session_id
        or log_event.get("sessionId")
        or log_event.get("session_id")
        or (evidence_bundle.sessionId if evidence_bundle else None)
    )
    amendment_evidence = list(evidence or [])
    if evidence_bundle is not None:
        amendment_evidence.extend(bundle_evidence(evidence_bundle))
    if not amendment_evidence:
        amendment_evidence = _evidence_from_event(log_event)

    amendment = to_contract_amendment(
        file_path=wit_path,
        diff=diff,
        reason=_amendment_reason(log_event),
        evidence=amendment_evidence,
        session_id=str(session or ""),
    )
    _persist_contract_amendment(wit_path.parent, amendment)
    return amendment


def _amendment_reason(log_event: dict[str, Any]) -> str:
    reason = str(log_event.get("reason") or "").strip()
    if reason:
        return reason
    command = str(log_event.get("command") or "action")
    return f"Contract amendment suggested after blocked command: {command[:160]}"


def _evidence_from_event(log_event: dict[str, Any]) -> list[str]:
    evidence: list[str] = []
    source = str(log_event.get("source") or "").strip()
    command = str(log_event.get("command") or "").strip()
    matched = str(log_event.get("matched_rule") or log_event.get("ruleId") or "").strip()
    if source:
        evidence.append(f"source: {source}")
    if command:
        evidence.append(f"command: {command}")
    if matched:
        evidence.append(f"matched rule: {matched}")
    return evidence


def _persist_contract_amendment(repo_root: Path, amendment: ContractAmendment) -> None:
    path = repo_root / ".witsmith" / "amendments" / f"{amendment.id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(amendment.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def apply_demo_path_rules(wit_path: Path, log_event: dict[str, Any]) -> None:
    """Append narrow path deny rules after a deny — keeps YAML valid for the demo."""
    wit = load_wit(wit_path)
    src = str(log_event.get("source") or "repo file")
    wit.deny.append(
        Rule(
            paths=["**/RECENT_NOTES.md", "**/NOTES.md"],
            reason=f"auto-amended after deny (source={src})",
        )
    )
    payload = wit.model_dump(mode="json", exclude_none=True)
    wit_path.write_text(
        yaml.safe_dump(payload, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )

