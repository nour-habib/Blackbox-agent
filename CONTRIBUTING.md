# Contributing to Witsmith
 
Witsmith (formerly Blackbox-agent) is a local safety, recorder, and evidence layer for AI coding-agent sessions. It gates risky commands through a repo contract, records observable evidence from a session, and produces a session artifact that downstream memory, analysis, and dashboard layers consume.
 
This guide explains how to get the project running, where to make changes, and the rules that keep four people working in parallel without stepping on each other.
 
## Before you start
 
Read the [README](./README.md) end to end. Witsmith has strong opinions about what it does and does not do, and contributions that violate those opinions will be sent back. In particular:
 
- Witsmith records **observable evidence only** — commands, stdout/stderr, exit codes, diffs, file hashes, contract decisions, and agent-written trace summaries. Do not add hidden chain-of-thought capture or Cursor-internals scraping.
- The CLI is named `witsmith`, not `blackbox`. Do not introduce a parallel `blackbox` command.
- `.witsmith/log.jsonl` is the single command-event log. Do not create a duplicate log.
## Repo layout
 
| Path | What lives here |
| --- | --- |
| `apps/cli/witsmith/` | Python Witsmith CLI (source of truth for local capture). Run with `uv`. |
| `apps/cli/package.json` | Incomplete npm wrapper — points to missing `./bin/witsmith.js`. Do not rely on it yet. |
| `apps/backend/` | Backend workspace for future API/database integration. |
| `apps/frontend/` | Next.js dashboard. |
| `frontend/` | Sibling frontend workspace (see commit history before editing). |
 
## Development setup
 
You need Python 3.11+, [`uv`](https://docs.astral.sh/uv/), and Node 20+ for the frontend.
 
```
git clone https://github.com/aristi1215/Blackbox-agent.git
cd Blackbox-agent
```
 
### Python CLI
 
```
cd apps/cli/witsmith
uv sync
uv run witsmith --help
uv run witsmith version
uv run witsmith scaffold --cwd .
uv run witsmith run "npm test" --cwd demo-repo --no-exec
uv run ruff check src scripts
```
 
**Known blocker:** `uv run witsmith --help` currently fails until `apps/cli/witsmith/README.md` exists, because `apps/cli/witsmith/pyproject.toml` declares `readme = "README.md"`. If you hit this, add a minimal README in that directory as your first commit.
 
### Frontend
 
```
cd apps/frontend   # or `frontend/` depending on which workspace you're touching
npm install
npm run dev
```
 
The dashboard builds against mocked session and memory data first. Do not call sponsor APIs (CLōD, Nia, Greptile) directly from the dashboard — read sponsor metadata off the imported records.
 
## Areas of the codebase
 
Witsmith has four loosely coupled areas. Any of them is fair game for contribution — pick what matches your interest.
 
- **CLI session lifecycle** — `init`, `start`, `finish`, `context`, `stale-check`, git capture, and the `.witsmith/sessions/<session_id>.json` artifact. Python, lives in `apps/cli/witsmith/`.
- **Memory and retrieval** — TypeScript/Prisma importer for session JSON, memory card generation (`generateMemories`), retrieval (`getContextForTask`), stale detection (`runStaleCheck`), and sponsor integrations (CLōD first; Nia and Greptile optional).
- **Dashboard** — Next.js UI: session timeline, memory cards, stale warnings, demo seed data.
- **Safety layer** — `witsmith run` gatekeeper, `AGENT_WIT.yaml` contract engine, `amend`/`rescue`, `witsmith-server` MCP tools.
Good first contributions: bug fixes, docs, tests, or issues labeled `good-first-issue` / `help-wanted`.
 
## Shared interfaces — do not break these
 
Four people work async around these contracts. Treat them as load-bearing.
 
**`.witsmith/log.jsonl`** — append-only JSONL of command events. Each line:
 
```
{
  "action_id": "act_...",
  "ts": "2026-...",
  "command": "npm test",
  "cwd": "...",
  "source": "user",
  "decision": "allow",
  "reason": "...",
  "matched_rule": "...",
  "confidence": 0.92,
  "cache_hit": false,
  "executed": true,
  "exit_code": 0,
  "stdout": "...",
  "stderr": "..."
}
```
 
**`.witsmith/sessions/<session_id>.json`** — the cross-team handoff artifact produced by `witsmith finish`. See the README for the full shape. If you add or rename a field, update the README, the Prisma schema draft, and any mocked fixtures in the same PR.
 
**Memory card JSON** — see the README's "Shared Interfaces" section. Same rule: field changes ripple through Nour's importer and Juan's dashboard, so coordinate.
 
**`AGENT_WIT.yaml`** — the contract grammar is `allow` / `ask` / `deny`. Do not introduce `block` unless you are also adding an adapter.
 
## What not to build
 
Repeated from the README because we keep getting drive-by PRs for these:
 
- A separate `blackbox` CLI.
- A dashboard inside the CLI package.
- A new command log that duplicates `.witsmith/log.jsonl`.
- Hidden chain-of-thought capture.
- Cursor internals scraping.
- A database-first architecture before the session JSON artifact is stable.
## Working on issues
 
Pick something from [Issues](https://github.com/aristi1215/Blackbox-agent/issues). Comment on the issue before you start so two people don't duplicate work. If you want to file a new issue, include:
 
- What you observed (command, output, expected vs. actual).
- The Witsmith version (`uv run witsmith version`).
- Whether it touches a shared interface.
For new features outside the four-person MVP plan, open a discussion or issue first. Implementation PRs for unscoped features will be closed.
 
## Pull request checklist
 
- [ ] Branch off `main`. Name it `<area>/<short-slug>` (e.g. `cli/witsmith-init`, `frontend/session-timeline`).
- [ ] Commits are small and have meaningful messages. Squash trivial fixups before review.
- [ ] If the change touches `.witsmith/log.jsonl`, `.witsmith/sessions/*.json`, the memory card schema, or the Prisma schema, **say so in the PR description** so maintainers can review the ripple effects.
- [ ] Python changes pass `uv run ruff check src scripts` in `apps/cli/witsmith/`.
- [ ] New CLI commands have a `--help` entry and at least one example in the PR description.
- [ ] Frontend changes include a screenshot or short clip.
- [ ] No secrets, `.env` files, `.witsmith/` runtime data, or `demo-repo/prisma/dev.db` committed.
- [ ] README updated if you added a command, changed a shared interface, or changed setup steps.
## PR description template
 
```
## What
One-sentence summary.
 
## Why
Link the issue, or explain the user-visible problem this solves.
 
## Shared interfaces touched
- [ ] .witsmith/log.jsonl event shape
- [ ] .witsmith/sessions/<id>.json shape
- [ ] Memory card schema
- [ ] AGENT_WIT.yaml grammar
- [ ] Prisma schema
- [ ] None
 
## How to verify
Commands or steps a reviewer can run.
 
## Screenshots / output
(if relevant)
```
 
## Style and conventions
 
- Python: ruff is the source of truth. Match existing module layout under `apps/cli/witsmith/src/`.
- TypeScript: follow the patterns in the existing frontend workspace. Prefer `type` aliases over `interface` for data shapes that map to JSON.
- Filenames: snake_case for Python modules, kebab-case for TypeScript components, lowercase for CLI command names.
- Commit messages: imperative mood ("add witsmith init", not "added" or "adds"). Prefix with the area when useful: `cli:`, `frontend:`, `docs:`, `contract:`.
## Refreshing `apps/cli/witsmith/` from another working copy
 
If the canonical hackathon edits live elsewhere, use the rsync command in the README to refresh the directory inside this fork. Do not hand-merge — it will desync.
 
## Code of conduct
 
Be direct, be kind, assume good faith. Review comments should land as suggestions, not verdicts. If a discussion stalls, ping a maintainer on the PR.
 
## License
 
By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE) that covers this project.
