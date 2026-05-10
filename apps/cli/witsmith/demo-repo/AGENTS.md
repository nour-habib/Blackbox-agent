# AGENTS.md — Witsmith hackathon working brief

You (any agent reading this) are joining a 5-hour hackathon build for **Witsmith** — the agent permission system that learns from prompt injections. Read this before doing anything else.

## North Star

Ship a **3-minute demo** at the Cursor hackathon. The closed loop:

> contract → action → fail → recover → amend → contract

The wow moment is the **live YAML diff** where Witsmith amends its own wit after a prompt-injection. If a task doesn't move that demo forward, it doesn't matter — drop it.

Product: **Witsmith**. Agent protagonist: **Smith**. Closer: **"Free your Smith."**

## Read first, in this order

1. `docs/master_playbook.md` — the locked plan, hour-by-hour, with the cut list
2. `docs/pitch_story.md` — the demo script (the deliverable's final shape)
3. `DONE.md` — what's already shipped, what's next, what's blocked
4. `docs/CLōD.md` — API credentials. Never paste them anywhere external.

## The loop (how to work)

Each pass:

1. **Read `DONE.md`** — know the state before you act
2. **Pick the smallest next thing** that advances the demo path
3. **Do it** (or spawn an agent to do it — see below)
4. **Append to `DONE.md`** the moment it's shipped, in the format the file specifies
5. **Loop**

Don't batch progress entries. Append as you go — a fresh agent is one crash away, and the file is the only handoff.

## When to spawn a subagent

Delegate when it's actually a different unit of work, not a different sentence:

- **Parallel & independent** — write the `wit_check` prompt while another writes the `analyze_failure` prompt. Spawn both in the same turn.
- **Research with a clear scope** — "find how `fastmcp` exposes structured-output tools, report under 200 words"
- **Verification** — "run the full demo path and report what broke"

Don't delegate understanding. Don't spawn for "based on your findings, fix the bug." Brief the subagent like a colleague who just walked in: goal, constraints, what's already ruled out, expected output length. They have none of this conversation.

## Demo-first rules (from the playbook)

- Code that doesn't appear in the demo doesn't exist.
- The cut list is not aspirational. Check the hour gate every hour.
- **Never cut**: the amendment-loop wow moment, the prompt-injection beat, the cold open.
- First cut signals: terminal polish, second failure scenario, README beyond one paragraph, the `wit_init` LLM call.

## Hand-off discipline

Before you stop — even mid-task — append to `DONE.md`:

- what you shipped (file paths, what works)
- what's blocked, and on what
- the obvious next step

Treat the next agent as a stranger with only this folder. If it's not in `DONE.md` or in code, it didn't happen.

---

Tight loop. Append done. Delegate parallel work. Cut without ego. Demo over everything.
