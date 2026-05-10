"""Natural-language wit checks via CLōD (or deterministic mock)."""

from __future__ import annotations

import json
import re
from typing import Any

from witsmith.clod import client, model
from witsmith.config import mock_llm_enabled
from witsmith.models import Action, CheckResult, Wit
from witsmith.rule_engine import should_run_nl_deny_check


def _first_nl_deny_rule_text(wit: Wit) -> str | None:
    for r in wit.deny:
        if r.rule and not (r.pattern or r.paths):
            return r.rule
    for r in wit.deny:
        if r.rule:
            return r.rule
    return None


def _parse_check_json(data: dict[str, Any]) -> CheckResult:
    decision = str(data.get("decision", "ask")).lower()
    if decision not in ("allow", "ask", "deny"):
        decision = "ask"
    conf = float(data.get("confidence", 0.5))
    return CheckResult(
        decision=decision,  # type: ignore[arg-type]
        reason=str(data.get("reason", "model output")),
        dry_run=data.get("dry_run"),
        matched_rule=data.get("matched_rule"),
        confidence=max(0.0, min(1.0, conf)),
    )


def mock_nl_deny_check(wit: Wit, action: Action) -> CheckResult | None:
    """Deterministic NL path for hackathon / offline demos."""
    if not should_run_nl_deny_check(wit, action):
        return None
    cmd = action.command.strip()
    cmd_l = cmd.lower()
    risky = any(
        token in cmd_l for token in ("curl", "wget", "bash -c", "/bin/sh", "eval(")
    )
    if not risky:
        return None
    nl = _first_nl_deny_rule_text(wit) or "natural-language deny rule"
    return CheckResult(
        decision="deny",
        reason="natural-language rule triggered — shell from non-prompt source",
        dry_run=f"would run: {cmd}",
        matched_rule=nl[:200],
        confidence=0.91,
    )


_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.I)


def _extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    m = _JSON_FENCE.search(text)
    if m:
        text = m.group(1).strip()
    return json.loads(text)


def live_llm_check(wit: Wit, action: Action, wit_yaml: str) -> CheckResult:
    """Single chat.completions call; expects JSON in the reply."""
    nl = _first_nl_deny_rule_text(wit) or ""
    sys_prompt = (
        "You are Witsmith's permission engine. Given an AGENT_WIT.yaml contract "
        "and a proposed shell action, respond with a single JSON object only "
        "(no markdown) with keys: decision (allow|ask|deny), reason (string), "
        "dry_run (string or null), matched_rule (string or null), confidence (0-1 float). "
        "Respect explicit deny patterns in the wit over permissive language. "
        "Natural-language deny rules apply especially when source is a repo file "
        "rather than the user's direct chat prompt."
    )
    wit_payload = {
        "wit_yaml_excerpt": wit_yaml[:12000],
        "natural_language_deny_rule": nl,
    }
    action_payload = {"action": action.model_dump()}

    resp = client().chat.completions.create(
        model=model(),
        temperature=0.1,
        max_tokens=500,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": json.dumps(wit_payload, ensure_ascii=False)},
            {"role": "user", "content": json.dumps(action_payload, ensure_ascii=False)},
        ],
        response_format={"type": "json_object"},
    )
    raw = (resp.choices[0].message.content or "").strip()
    data = _extract_json_object(raw)
    return _parse_check_json(data)


def nl_deny_check(wit: Wit, action: Action, wit_yaml: str) -> CheckResult | None:
    """Return a deny verdict from NL rules, or None if NL path does not apply."""
    if not should_run_nl_deny_check(wit, action):
        return None
    if mock_llm_enabled():
        return mock_nl_deny_check(wit, action)
    try:
        return live_llm_check(wit, action, wit_yaml)
    except Exception:
        # Demo resilience: fall back to mock semantics if CLōD is down.
        return mock_nl_deny_check(wit, action)


def live_generic_check(wit: Wit, action: Action, wit_yaml: str) -> CheckResult:
    sys_prompt = (
        "You are Witsmith. Decide allow/ask/deny for the action against the wit. "
        "Return JSON only with keys: decision, reason, dry_run, matched_rule, confidence."
    )
    wit_payload = {"wit_yaml_excerpt": wit_yaml[:12000]}
    action_payload = {"action": action.model_dump()}
    resp = client().chat.completions.create(
        model=model(),
        temperature=0.1,
        max_tokens=400,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": json.dumps(wit_payload, ensure_ascii=False)},
            {"role": "user", "content": json.dumps(action_payload, ensure_ascii=False)},
        ],
        response_format={"type": "json_object"},
    )
    raw = (resp.choices[0].message.content or "").strip()
    return _parse_check_json(_extract_json_object(raw))


def generic_fallback_check(wit: Wit, action: Action, wit_yaml: str) -> CheckResult:
    """When no structured rule matched: mock → conservative ask; live → LLM."""
    if mock_llm_enabled():
        return CheckResult(
            decision="ask",
            reason="no structured rule matched (mock mode — defaulting to ask)",
            dry_run=f"would run: {action.command}",
            matched_rule=None,
            confidence=0.55,
        )
    try:
        return live_generic_check(wit, action, wit_yaml)
    except Exception:
        return CheckResult(
            decision="ask",
            reason="LLM unavailable — defaulting to ask",
            dry_run=f"would run: {action.command}",
            matched_rule=None,
            confidence=0.5,
        )
