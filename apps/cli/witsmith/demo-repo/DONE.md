# DONE.md — Witsmith build ledger

Append-only. The next agent reads this to know where things stand. Don't rewrite history; correct with a new entry.

## Format

Every entry, one line:

```
- YYYY-MM-DD HH:MM | <area> | <what shipped> | <path or pointer>
```

Areas: `plan`, `prep`, `scaffold`, `wit_init`, `wit_check`, `replay`, `rescue`, `amend`, `demo`, `slides`, `cut`, `blocked`, `note`.

If you cut something per the playbook's cut list, log it as `cut`. If you're blocked, log it as `blocked` with what's needed to unblock.

## State summary (overwrite this block as it changes)

- **Phase:** demo path — `wit_check` + JSONL replay + SQLite cache + CLI `run` / `amend --last` / `rescue --last`; MCP tools call the same stack. Use `WITSMITH_MOCK_LLM=1` until CLōD quota is back; unset for live `json_object` calls on NL + generic + amend + analyze.
- **Next action:** With credits: unset `WITSMITH_MOCK_LLM`, run `uv run python scripts/smoke_clod.py`, then spot-check one live `wit_check` on the three demo strings. Pre-warm cache before stage (playbook 4:45–4:55). For the full Next+Prisma backup path: `cd demo-repo && npm install && npx prisma migrate deploy` (see `demo-repo/README.md`).
- **Blocked on:** Nothing in-repo — CLōD quota still external until dashboard/wallet/key fixed.

## Entries

- 2026-05-08 | plan | Wrote shared agent mindset and this ledger | AGENTS.md, DONE.md
- 2026-05-08 | plan | Renamed "passport" → "wit" project-wide (AGENT_WIT.yaml, wit_check, wit_init, Permission Wit) | docs/master_playbook.md, docs/pitch_story.md, AGENTS.md, DONE.md
- 2026-05-08 | scaffold | Python project skeleton (uv + pyproject + src/witsmith package) | pyproject.toml, .gitignore, src/witsmith/__init__.py
- 2026-05-08 | prep | CLōD wrapper (Anthropic SDK + custom base_url) and env template | src/witsmith/clod.py, .env.example
- 2026-05-08 | prep | CLōD smoke test script (must be run on user's Mac — sandbox can't reach api.clod.io) | scripts/smoke_clod.py
- 2026-05-08 | scaffold | Pydantic models for Wit / Action / CheckResult / FailureAnalysis | src/witsmith/models.py
- 2026-05-08 | scaffold | fastmcp server with 4 stub tools (wit_init, wit_check, analyze_failure, propose_amendment) | src/witsmith/server.py
- 2026-05-08 | scaffold | Witsmith CLI entry point (version + help; run wired in hour 2:30) | src/witsmith/cli.py
- 2026-05-08 | prep | Staged starter AGENT_WIT.yaml and the prompt-injection RECENT_NOTES.md | AGENT_WIT.yaml, RECENT_NOTES.md
- 2026-05-08 | prep | Bootstrap README with the 4 commands the user runs locally | README.md
- 2026-05-08 | blocked | CLōD smoke + uv sync not verified — sandbox proxy blocks api.clod.io and PyPI. Unblocks once user runs `uv sync` and `uv run python scripts/smoke_clod.py` on Mac.
- 2026-05-08 | note | First smoke run errored: CLōD is OpenAI-compatible (`/v1/chat/completions`), not Anthropic-native (`/v1/messages`). Verified by clod.io/models — Claude offerings stop at claude-sonnet-4-5; claude-sonnet-4-6 is Anthropic-direct only. | https://clod.io/models
- 2026-05-08 | prep | Pivoted SDK from `anthropic` to `openai`; default model `claude-sonnet-4-5`; env vars renamed CLOD_API_KEY / CLOD_BASE_URL (with OPENAI_* fallback) | pyproject.toml, src/witsmith/clod.py, scripts/smoke_clod.py, .env.example, src/witsmith/cli.py
- 2026-05-08 | plan | Updated playbook tech-stack + Block 1 prep to match the OpenAI-via-CLōD reality | docs/master_playbook.md
- 2026-05-08 | prep | Fixed pyproject deprecation: `tool.uv.dev-dependencies` → `dependency-groups.dev` | pyproject.toml
- 2026-05-08 | note | claude-sonnet-4-5 returned 403 "Team quota exceeded" — premium models are gated. Pivoted default to free-tier model. | (clod.io quota)
- 2026-05-08 | prep | Default model now `gpt-oss-120b` (free tier); `.env.example` lists free + premium alternatives; playbook tech-stack updated to free-for-build / premium-for-demo. | src/witsmith/clod.py, .env.example, docs/master_playbook.md
- 2026-05-09 | prep | CLōD `.env` resolution walks up to repo `pyproject.toml` so `.env` loads regardless of cwd; `.env` default model `gpt-oss-120b`; smoke script honors optional `WITSMITH_SMOKE_MODEL`. | src/witsmith/clod.py, .env, scripts/smoke_clod.py, .env.example
- 2026-05-09 | blocked | Smoke still 403 `Team quota exceeded` with shared team key — confirm dashboard team/project matches key or fund wallet / use personal key. | api.clod.io
- 2026-05-09 | note | Cross-domain reliability research grounding the Witsmith loop: aviation/DO-178C, NASA FDIR, ISO 26262/ASIL, IBM MAPE-K (closest precedent), saga + compensating txns, Hystrix circuit breaker/bulkhead, Google SRE blameless postmortems, 2026 agent-runtime safety. Includes concrete mapping into wit_check / analyze_failure / propose_amendment and a Q&A line citing MAPE-K. | docs/reliability_research.md
- 2026-05-09 19:43 | wit_check | Structured rules + NL-first path + confidence floor; SQLite verdict cache; `WITSMITH_MOCK_LLM` for deterministic offline demo | src/witsmith/check_service.py, src/witsmith/rule_engine.py, src/witsmith/llm_check.py, src/witsmith/cache_store.py, src/witsmith/config.py
- 2026-05-09 19:43 | replay | Append-only `.witsmith/log.jsonl`, last-deny lookup, handoff markdown | src/witsmith/replay.py, src/witsmith/analyze_service.py
- 2026-05-09 19:43 | amend | Mock/live YAML diff + optional `--apply` append of path deny rules | src/witsmith/amend_service.py
- 2026-05-09 19:43 | demo | CLI: `witsmith run "<cmd>"`, `witsmith amend --last`, `witsmith rescue --last`; MCP four tools wired (wit_init returns existing wit excerpt) | src/witsmith/cli.py, src/witsmith/server.py
- 2026-05-09 19:43 | prep | `.env.example` documents `WITSMITH_MOCK_LLM` for quota-free rehearsal | .env.example
- 2026-05-09 | demo | `witsmith run --no-exec` no longer prompts on ASK (avoids hung stdin when only showing verdict) | src/witsmith/cli.py
- 2026-05-09 19:56 | slides | LaTeX Beamer pitch deck with 5 v2 slides, disabled playbook appendix frames, asset checklist, and generated PDF | slides/witsmith_pitch.tex, slides/README.md, slides/assets/README.md, slides/witsmith_pitch.pdf
- 2026-05-09 20:16 | slides | Rebuilt `witsmith_pitch.pdf` with `slides/assets/smith.png` on the Meet Smith slide | slides/witsmith_pitch.pdf
- 2026-05-09 20:18 | slides | Fixed Meet Smith image: asset was saved as ` smith.png` (leading space); renamed to `smith.png` and rebuilt PDF (~1.9MB with embedded PNG) | slides/assets/smith.png, slides/witsmith_pitch.pdf, slides/assets/README.md
- 2026-05-09 20:22 | rescue | Handoff markdown names are human-readable (source-based deny stem, Prisma+0042 → `0042-smith-strikes-again`); collision adds action_id suffix; `--handoff-stem` + `WITSMITH_HANDOFF_STEM` override | src/witsmith/analyze_service.py, src/witsmith/cli.py, .env.example
- 2026-05-09 20:28 | prep | Cleared `.witsmith/handoffs`, truncated `log.jsonl`, removed verdict `cache.sqlite`; added `demo-repo/` (playbook Block 2: Next 14 + Prisma, migrations incl. 0042 drop, API+test, wit + RECENT_NOTES); root README + `.gitignore` updated | demo-repo/, README.md, .gitignore, AGENT_WIT.yaml, DONE.md
- 2026-05-10 | prep | Root `.gitignore`: ignore `docs/` + `slides/`, tighten Python crumbs; README trimmed — points at AGENTS/DONE, documents local-only docs/slides | .gitignore, README.md
- 2026-05-10 | prep | Root `DONE.md`, `AGENTS.md`, `RECENT_NOTES.md` gitignored; bundled defaults under `witsmith.scaffold_templates`; CLI/MCP create them beside `AGENT_WIT.yaml` when missing (`witsmith scaffold` or first `run`/`amend`/`rescue`) | src/witsmith/scaffold_docs.py, src/witsmith/scaffold_templates/, .gitignore, src/witsmith/cli.py, src/witsmith/server.py
- 2026-05-10 | prep | `.gitignore`: ignore `/dist/` from local `uv build` | .gitignore
- 2026-05-10 | prep | Markdown cleanup (root + demo-repo + slides README); Witsmith mirrored into monorepo fork `Blackbox-agent/witsmith/` next to `apps/*` | README.md, demo-repo/README.md, slides/README.md, https://github.com/yaoDu/Blackbox-agent
- 2026-05-10 | prep | `.gitignore`: track `docs/` + `slides/` (remove blanket ignore); README + slides README updated | .gitignore, README.md, slides/README.md
- 2026-05-10 | prep | Published Witsmith under GitHub fork `yaoDu/Blackbox-agent` in path `witsmith/` beside `apps/*`; monorepo root `.gitignore`, README rsync recipe, fork `package.json` URLs → yaoDu | README.md
