"""Witsmith CLI — `run`, `amend`, `rescue`, and config introspection."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from witsmith import __version__
from witsmith.amend_service import apply_demo_path_rules, propose_contract_amendment
from witsmith.analyze_service import analyze_log_event, write_handoff
from witsmith.check_service import run_wit_check
from witsmith.clod import DEFAULT_BASE_URL, DEFAULT_MODEL, model
from witsmith.config import witsmith_data_dirname
from witsmith.contracts import parse_evidence_bundle, to_contract_decision, to_contract_event
from witsmith.layout import find_wit_file
from witsmith.models import Action, CheckResult
from witsmith.replay import append_event, new_action_id, read_last_deny, utc_now_iso
from witsmith.scaffold_docs import ensure_hackathon_docs
from witsmith.session import (
    cmd_clean,
    cmd_context,
    cmd_finish,
    cmd_init,
    cmd_stale_check,
    cmd_start,
)


def _print_verdict(result: CheckResult, source: str | None) -> None:
    emoji = {"allow": "🟢", "ask": "🟡", "deny": "🔴"}[result.decision]
    upper = result.decision.upper()
    print(f"{emoji} {upper} — {result.reason}")
    if source:
        print(f"   source: {source}")
    if result.dry_run:
        print(f"   dry-run: {result.dry_run}")
    if result.matched_rule:
        print(f"   matched_rule: {result.matched_rule}")
    print(f"   confidence: {result.confidence:.2f}")


def _require_wit(start: Path) -> Path:
    wit = find_wit_file(start)
    if wit is None:
        print("witsmith: AGENT_WIT.yaml not found (walked parents from cwd).", file=sys.stderr)
        sys.exit(3)
    ensure_hackathon_docs(wit.parent)
    return wit


def _print_json(payload: dict) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _run_payload(result: CheckResult, action: Action, log_event: dict, meta: dict) -> dict:
    return {
        "decision": to_contract_decision(result, action).model_dump(mode="json"),
        "event": to_contract_event(log_event).model_dump(mode="json"),
        "_witsmith": {
            "meta": meta,
            "action_id": log_event.get("action_id"),
        },
    }


def _load_evidence_bundle(path_text: str):
    path_text = path_text.strip()
    if not path_text:
        return None
    path = Path(path_text).expanduser().resolve()
    data = json.loads(path.read_text(encoding="utf-8"))
    return parse_evidence_bundle(data)


def cmd_run(ns: argparse.Namespace) -> int:
    command = ns.shell_cmd.strip()
    if not command:
        print("witsmith run: empty command", file=sys.stderr)
        return 2
    cwd = Path(ns.cwd).expanduser().resolve()
    wit_path = _require_wit(cwd)
    repo_root = wit_path.parent
    dirname = witsmith_data_dirname()
    source = ns.source

    action = Action(command=command, cwd=str(cwd), session_id=ns.session_id, source=source)
    result, meta = run_wit_check(action, wit_path, use_cache=not ns.no_cache)
    if not ns.emit_json:
        _print_verdict(result, source)

    action_id = new_action_id()
    base_log = {
        "action_id": action_id,
        "ts": utc_now_iso(),
        "command": command,
        "cwd": str(cwd),
        "source": source,
        "session_id": ns.session_id,
        "decision": result.decision,
        "reason": result.reason,
        "matched_rule": result.matched_rule,
        "confidence": result.confidence,
        "cache_hit": meta.get("cache_hit", False),
        "executed": False,
        "exit_code": None,
        "stdout": "",
        "stderr": "",
    }

    if result.decision == "deny":
        append_event(repo_root, dirname, base_log)
        if ns.emit_json:
            _print_json(_run_payload(result, action, base_log, meta))
        return 2

    if result.decision == "ask":
        # Verdict-only runs should not block on stdin (CI / `--no-exec` demos).
        if ns.no_exec:
            append_event(repo_root, dirname, base_log)
            if ns.emit_json:
                _print_json(_run_payload(result, action, base_log, meta))
            return 0
        if ns.yes:
            answer = "y"
        else:
            try:
                answer = input("Execute? [y/N]: ").strip().lower()
            except EOFError:
                answer = "n"
        if answer not in {"y", "yes"}:
            append_event(repo_root, dirname, base_log)
            if ns.emit_json:
                _print_json(_run_payload(result, action, base_log, meta))
            return 1

    if ns.no_exec:
        append_event(repo_root, dirname, base_log)
        if ns.emit_json:
            _print_json(_run_payload(result, action, base_log, meta))
        return 0

    proc = subprocess.run(
        ["/bin/sh", "-c", command],
        cwd=str(cwd),
        capture_output=True,
        text=True,
    )
    base_log["executed"] = True
    base_log["exit_code"] = proc.returncode
    base_log["stdout"] = proc.stdout[-8000:]
    base_log["stderr"] = proc.stderr[-8000:]
    append_event(repo_root, dirname, base_log)
    if ns.emit_json:
        _print_json(_run_payload(result, action, base_log, meta))
    elif proc.stdout:
        sys.stdout.write(proc.stdout)
    if not ns.emit_json and proc.stderr:
        sys.stderr.write(proc.stderr)
    return proc.returncode


def cmd_amend(ns: argparse.Namespace) -> int:
    if not ns.last:
        print("witsmith amend: pass --last (hackathon demo path).", file=sys.stderr)
        return 2
    cwd = Path(ns.cwd).expanduser().resolve()
    wit_path = _require_wit(cwd)
    repo_root = wit_path.parent
    dirname = witsmith_data_dirname()
    last = read_last_deny(repo_root, dirname)
    if last is None:
        print("witsmith amend: no deny events in the replay log yet.", file=sys.stderr)
        return 4
    evidence_bundle = _load_evidence_bundle(ns.evidence_file) if ns.evidence_file else None
    amendment = propose_contract_amendment(
        wit_path,
        last,
        evidence_bundle=evidence_bundle,
        session_id=ns.session_id,
    )
    if ns.emit_json:
        _print_json(amendment.model_dump(mode="json"))
    else:
        print(amendment.diff)
    if ns.apply:
        if not ns.yes:
            try:
                ans = input("Apply amendment to AGENT_WIT.yaml? [y/N]: ").strip().lower()
            except EOFError:
                ans = "n"
            if ans not in {"y", "yes"}:
                print("Aborted.")
                return 0
        apply_demo_path_rules(wit_path, last)
        if not ns.emit_json:
            print(f"Updated {wit_path}")
    return 0


def cmd_rescue(ns: argparse.Namespace) -> int:
    if not ns.last:
        print("witsmith rescue: pass --last.", file=sys.stderr)
        return 2
    cwd = Path(ns.cwd).expanduser().resolve()
    wit_path = _require_wit(cwd)
    repo_root = wit_path.parent
    dirname = witsmith_data_dirname()
    last = read_last_deny(repo_root, dirname)
    if last is None:
        print("witsmith rescue: no deny events found.", file=sys.stderr)
        return 4
    analysis = analyze_log_event(last)
    print(json.dumps(analysis.model_dump(), indent=2, ensure_ascii=False))
    stem_override = (ns.handoff_stem or "").strip() or None
    note_path = write_handoff(
        repo_root,
        dirname,
        last,
        analysis.handoff_note,
        stem_override=stem_override,
    )
    print(f"Handoff written to {note_path}")
    return 0


def cmd_scaffold(ns: argparse.Namespace) -> int:
    """Write missing DONE.md / AGENTS.md / RECENT_NOTES.md next to the wit file."""
    cwd = Path(ns.cwd).expanduser().resolve()
    wit_path = find_wit_file(cwd)
    if wit_path is None:
        print("witsmith: AGENT_WIT.yaml not found (walked parents from cwd).", file=sys.stderr)
        return 3
    created = ensure_hackathon_docs(wit_path.parent)
    if created:
        print(f"witsmith scaffold: wrote {', '.join(created)} beside {wit_path}")
    else:
        print(f"witsmith scaffold: DONE.md, AGENTS.md, RECENT_NOTES.md already present near {wit_path}")
    return 0


def cmd_version() -> int:
    base = (
        os.environ.get("CLOD_BASE_URL")
        or os.environ.get("OPENAI_BASE_URL")
        or DEFAULT_BASE_URL
    )
    print(f"witsmith {__version__}")
    print(f"  model:    {model()}")
    print(f"  base_url: {base}")
    print(f"  default:  {DEFAULT_MODEL} (override with WITSMITH_MODEL)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="witsmith", description="Agent permission checks + replay log.")
    sub = p.add_subparsers(dest="cmd")

    pi = sub.add_parser("init", help="Initialize Witsmith runtime files")
    pi.add_argument("--cwd", default=".", help="Repo/project root to initialize")

    pst = sub.add_parser("start", help="Start a Witsmith recording session")
    pst.add_argument("task", help="Task description for this session")
    pst.add_argument("--cwd", default=".", help="Repo/project root for the session")

    pf = sub.add_parser("finish", help="Finish the active Witsmith recording session")
    pf.add_argument("--cwd", default=".", help="Repo/project root for the session")

    pc = sub.add_parser("context", help="Write relevant memory context for a new task")
    pc.add_argument("task", help="Next task to retrieve context for")
    pc.add_argument("--cwd", default=".", help="Repo/project root to read sessions from")

    pscq = sub.add_parser("stale-check", help="Count memory cards; hash stale-check comes later")
    pscq.add_argument("--cwd", default=".", help="Repo/project root to read sessions from")

    pcl = sub.add_parser("clean", help="Remove Witsmith runtime artifacts")
    pcl.add_argument("--cwd", default=".", help="Repo/project root to clean")
    pcl.add_argument("--yes", action="store_true", help="Actually delete files; default is dry-run")
    pcl.add_argument("--sessions", action="store_true", help="Also remove .witsmith/sessions")
    pcl.add_argument(
        "--all",
        dest="clean_all",
        action="store_true",
        help="Remove the full .witsmith directory and Witsmith Cursor rule",
    )

    pr = sub.add_parser("run", help="wit_check → optional execute")
    pr.add_argument(
        "shell_cmd",
        help='Shell string, e.g. \'rm -rf node_modules\'',
    )
    pr.add_argument("--cwd", default=".", help="Working directory for the subprocess")
    pr.add_argument(
        "--source",
        default="user",
        help='Provenance label, e.g. "RECENT_NOTES.md"',
    )
    pr.add_argument("--session-id", default="", help="Blackbox session id for replay events")
    pr.add_argument(
        "--emit-json",
        action="store_true",
        help="Emit ContractDecision + ContractEvent JSON for programmatic callers",
    )
    pr.add_argument("--no-cache", action="store_true", help="Bypass the SQLite verdict cache")
    pr.add_argument("--no-exec", action="store_true", help="Print verdict only; never run the shell")
    pr.add_argument("-y", "--yes", action="store_true", help="Auto-confirm ASK prompts (demo mode)")

    pa = sub.add_parser("amend", help="Propose YAML amendment after a deny")
    pa.add_argument("--last", action="store_true", help="Use the most recent deny from the replay log")
    pa.add_argument("--apply", action="store_true", help="Append hardened path rules to AGENT_WIT.yaml")
    pa.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompts")
    pa.add_argument("--cwd", default=".", help="Where to look for AGENT_WIT.yaml")
    pa.add_argument("--session-id", default="", help="Blackbox session id for the amendment")
    pa.add_argument(
        "--evidence-file",
        default="",
        help="Path to a SessionFile or EvidenceBundle JSON to use as amendment evidence",
    )
    pa.add_argument(
        "--emit-json",
        action="store_true",
        help="Emit ContractAmendment JSON instead of the human diff",
    )

    prs = sub.add_parser("rescue", help="Self-Rescue analysis for the last deny")
    prs.add_argument("--last", action="store_true", help="Analyze the latest deny event")
    prs.add_argument("--cwd", default=".", help="Where to look for AGENT_WIT.yaml")
    prs.add_argument(
        "--handoff-stem",
        default="",
        metavar="STEM",
        help="Basename for the handoff .md file (default: derived from source/command; "
        "env WITSMITH_HANDOFF_STEM also works)",
    )

    sub.add_parser("version", help="Print version + model config")

    psc = sub.add_parser(
        "scaffold",
        help="Create DONE.md / AGENTS.md / RECENT_NOTES.md next to AGENT_WIT.yaml if missing",
    )
    psc.add_argument("--cwd", default=".", help="Where to start searching for AGENT_WIT.yaml")

    return p


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    if not argv or argv[0] in {"-h", "--help"}:
        build_parser().print_help()
        return 0

    if argv[0] == "version":
        return cmd_version()

    parser = build_parser()
    ns = parser.parse_args(argv)

    if ns.cmd is None:
        parser.print_help()
        return 0
    if ns.cmd == "init":
        return cmd_init(ns.cwd)
    if ns.cmd == "start":
        return cmd_start(ns.task, ns.cwd)
    if ns.cmd == "finish":
        return cmd_finish(ns.cwd)
    if ns.cmd == "context":
        return cmd_context(ns.task, ns.cwd)
    if ns.cmd == "stale-check":
        return cmd_stale_check(ns.cwd)
    if ns.cmd == "clean":
        return cmd_clean(ns.cwd, yes=ns.yes, sessions=ns.sessions, clean_all=ns.clean_all)
    if ns.cmd == "run":
        return cmd_run(ns)
    if ns.cmd == "amend":
        return cmd_amend(ns)
    if ns.cmd == "rescue":
        return cmd_rescue(ns)
    if ns.cmd == "scaffold":
        return cmd_scaffold(ns)
    if ns.cmd == "version":
        return cmd_version()
    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
