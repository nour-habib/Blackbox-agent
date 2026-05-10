# Witsmith

Agent permission and debugging CLI.

Witsmith is the local recorder and command gatekeeper for AI coding-agent
sessions. It checks commands against `AGENT_WIT.yaml`, writes observable action
events to `.witsmith/log.jsonl`, and packages finished sessions into JSON for
memory, analysis, and dashboard teammates.

Witsmith does not access hidden chain-of-thought. It records observable evidence
and optional agent-written trace summaries.

## What The CLI Does

The CLI is the local control layer for the project. It does three jobs:

1. Gatekeep risky agent actions using `AGENT_WIT.yaml`.
2. Record what happened during the agent session.
3. Produce clean evidence files for the dashboard, memory, and analysis layers.

Current commands:

```bash
witsmith init
witsmith start "task"
witsmith run "command"
witsmith finish
witsmith context "next task"
witsmith stale-check
witsmith clean
witsmith scaffold
witsmith amend --last
witsmith rescue --last
witsmith version
```

The important loop is:

```bash
witsmith init
witsmith start "task"
witsmith run "npm test"
witsmith finish
```

## Development Setup

```bash
uv sync
uv run witsmith --help
uv run witsmith version
```

## Smoke Tests

```bash
uv run witsmith scaffold --cwd .
uv run witsmith run "npm test" --cwd demo-repo --no-exec
uv run ruff check src scripts
```

For a live CLōD route check, configure `.env` with `CLOD_API_KEY`, then run:

```bash
uv run python scripts/smoke_clod.py
```

## Recorder Flow Test

```bash
uv run witsmith init --cwd demo-repo
uv run witsmith start "Fix OAuth redirect bug" --cwd demo-repo
uv run witsmith run "npm test" --cwd demo-repo --no-exec
uv run witsmith finish --cwd demo-repo
uv run witsmith context "Add refresh-token validation" --cwd demo-repo
uv run witsmith stale-check --cwd demo-repo
```

Use `--no-exec` when testing if you only want Witsmith's decision/logging
behavior and do not want the command to actually run.

## Cleanup

`witsmith clean` removes Witsmith-generated runtime artifacts. It is a dry run by
default:

```bash
uv run witsmith clean --cwd demo-repo
```

To actually delete the default runtime files:

```bash
uv run witsmith clean --cwd demo-repo --yes
```

Default cleanup targets:

```text
.witsmith/active-session.json
.witsmith/agent-trace.md
.witsmith/context.md
.witsmith/log.jsonl
.witsmith/cache.sqlite
.witsmith/cache.sqlite-journal
```

To also delete finished session JSON files:

```bash
uv run witsmith clean --cwd demo-repo --yes --sessions
```

To remove the full runtime directory and Witsmith Cursor rule:

```bash
uv run witsmith clean --cwd demo-repo --yes --all
```

`clean` does not remove `AGENT_WIT.yaml`, Prisma migrations, source files, or
`.env`.

## Runtime Files

`witsmith init` creates:

```text
demo-repo/
  AGENT_WIT.yaml
  .witsmith/
    config.json
    sessions/
    handoffs/
  .cursor/
    rules/
      witsmith-memory.mdc
```

`witsmith start` creates:

```text
.witsmith/active-session.json
.witsmith/agent-trace.md
```

`witsmith run` appends an action event to:

```text
.witsmith/log.jsonl
```

Example event:

```json
{
  "action_id": "abc123",
  "ts": "2026-05-10T...",
  "command": "npm test",
  "cwd": "...",
  "source": "user",
  "decision": "allow",
  "reason": "matched allow pattern:npm test",
  "matched_rule": "pattern:npm test",
  "confidence": 0.9,
  "cache_hit": false,
  "executed": false,
  "exit_code": null,
  "stdout": "",
  "stderr": ""
}
```

The main handoff artifact is:

```text
.witsmith/sessions/<session_id>.json
```

That file contains the raw evidence bundle plus a deterministic local report.

Example shape:

```json
{
  "evidenceBundle": {
    "id": "session_...",
    "task": "Fix OAuth redirect bug",
    "repoPath": "...",
    "branch": "main",
    "baseCommit": "abc123",
    "endCommit": "abc123",
    "startedAt": "...",
    "finishedAt": "...",
    "status": "finished",
    "changedFiles": [],
    "diff": "...",`
    "actions": [],
    "agentTrace": "# Witsmith Agent Trace..."
  },
  "report": {
    "summary": "...",
    "observedFacts": [],
    "agentReportedClaims": [],
    "inferredHypotheses": [],
    "memoryCards": []
  }
}
```

## Handoff To The Next Layer

Send the generated session file to the memory/analysis layer:

```text
apps/cli/witsmith/demo-repo/.witsmith/sessions/<session_id>.json
```

Nour's layer should import:

- `evidenceBundle.task`
- `evidenceBundle.changedFiles`
- `evidenceBundle.diff`
- `evidenceBundle.actions`
- `evidenceBundle.agentTrace`
- `report.memoryCards`

Juan's dashboard can use the same shape for mocked or real dashboard data.