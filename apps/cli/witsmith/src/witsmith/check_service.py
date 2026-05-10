"""End-to-end wit_check: structured rules → NL → generic; optional SQLite cache."""

from __future__ import annotations

from pathlib import Path

from witsmith.cache_store import cache_get, cache_key, cache_put
from witsmith.config import confidence_ask_threshold, witsmith_data_dirname
from witsmith.layout import repo_root_for_wit
from witsmith.llm_check import generic_fallback_check, nl_deny_check
from witsmith.models import Action, CheckResult
from witsmith.rule_engine import apply_structured_rules, should_run_nl_deny_check
from witsmith.wit_file import load_wit, wit_yaml_text


def _apply_confidence_floor(result: CheckResult) -> CheckResult:
    """Playbook: confidence < 0.7 forces ask (except hard deny)."""
    floor = confidence_ask_threshold()
    if result.decision == "deny":
        return result
    if result.confidence < floor and result.decision == "allow":
        return result.model_copy(
            update={
                "decision": "ask",
                "reason": f"{result.reason} (confidence {result.confidence:.2f} < {floor} → ask)",
            }
        )
    return result


def _meta_for_result(result: CheckResult, base: dict) -> dict:
    meta = dict(base)
    if result.model_name:
        meta["model"] = result.model_name
    if result.escalated_from:
        meta["escalated_from"] = result.escalated_from
    return meta


def run_wit_check(
    action: Action,
    wit_path: Path,
    *,
    use_cache: bool = True,
) -> tuple[CheckResult, dict]:
    """Return `(CheckResult, meta)` where meta includes `cache_hit` bool."""
    wit_path = wit_path.resolve()
    repo_root = repo_root_for_wit(wit_path)
    wit_yaml = wit_yaml_text(wit_path)
    wit = load_wit(wit_path)
    dirname = witsmith_data_dirname()
    db_path = repo_root / dirname / "cache.sqlite"

    key = cache_key(action, wit_yaml)
    if use_cache:
        cached = cache_get(db_path, key)
        if cached is not None:
            return cached, _meta_for_result(cached, {"cache_hit": True, "cache_key": key})

    # 1) NL-first for repo-file-originated risky commands (demo injection beat)
    if should_run_nl_deny_check(wit, action):
        nl = nl_deny_check(wit, action, wit_yaml)
        if nl is not None:
            out = _apply_confidence_floor(nl)
            cache_put(db_path, key, out)
            return out, _meta_for_result(
                out, {"cache_hit": False, "cache_key": key, "path": "nl"}
            )

    # 2) Structured allow / ask / deny
    structured = apply_structured_rules(wit, action, repo_root)
    if structured is not None:
        out = _apply_confidence_floor(structured)
        cache_put(db_path, key, out)
        return out, {"cache_hit": False, "cache_key": key, "path": "structured"}

    # 3) Generic
    generic = generic_fallback_check(wit, action, wit_yaml)
    out = _apply_confidence_floor(generic)
    cache_put(db_path, key, out)
    return out, _meta_for_result(
        out, {"cache_hit": False, "cache_key": key, "path": "generic"}
    )
