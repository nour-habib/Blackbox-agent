/**
 * Witsmith backend.
 *
 * Thin HTTP layer over @blackbox/core. Exposes the routes listed in
 * apps/core/API.md plus a few extras the dashboard needs:
 *
 *   GET  /api/health
 *   GET  /api/sessions                       — list session summaries
 *   GET  /api/sessions/:id                   — full SessionFile
 *   GET  /api/memories?sessionId=...         — loadMemories()
 *   POST /api/context                        — getContextForTask()
 *   POST /api/stale-check                    — runStaleCheck()
 *   POST /api/import-session                 — importSession({ path })
 *   GET  /api/safety/rules                   — parsed AGENT_WIT.yaml
 *   GET  /api/safety/events                  — parsed .witsmith/log.jsonl
 */
// MUST be first — populates process.env before any other module loads.
import "./env";

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import {
  importSession,
  loadMemories,
  getContextForTask,
  runStaleCheck,
} from "@blackbox/core";

const PORT = Number(process.env.PORT ?? 4001);

/** Repo we read sessions / safety log from. Default = the bundled demo repo. */
const REPO_PATH = path.resolve(
  __dirname,
  "..",
  process.env.REPO_PATH ?? "../cli/witsmith/demo-repo"
);
const WITSMITH_DIR = path.join(REPO_PATH, ".witsmith");
const SESSIONS_DIR = path.join(WITSMITH_DIR, "sessions");
const LOG_PATH = path.join(WITSMITH_DIR, "log.jsonl");
const CONTRACT_PATH = path.join(REPO_PATH, "AGENT_WIT.yaml");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

/* --------------------------- helpers --------------------------- */

function listSessionFiles(): string[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  return fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(SESSIONS_DIR, f));
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

/** Minimal AGENT_WIT.yaml parser. We only support the three top-level lists
 *  (allow / ask / deny), each containing entries with `pattern` + optional
 *  `reason`. Avoids pulling in a yaml dependency for this one file. */
function parseContract(text: string) {
  const rules: { decision: "allow" | "ask" | "deny"; pattern: string; reason?: string }[] = [];
  let current: "allow" | "ask" | "deny" | null = null;
  let pending: { pattern?: string; reason?: string } = {};

  const flush = () => {
    if (current && pending.pattern) {
      rules.push({ decision: current, pattern: pending.pattern, reason: pending.reason });
    }
    pending = {};
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const sectionMatch = line.match(/^(allow|ask|deny)\s*:\s*$/);
    if (sectionMatch) {
      flush();
      current = sectionMatch[1] as "allow" | "ask" | "deny";
      continue;
    }

    if (line.startsWith("  - ")) {
      flush();
      const after = line.slice(4).trim();
      const kv = after.match(/^(\w+)\s*:\s*(.*)$/);
      if (kv) {
        const [, k, v] = kv;
        const value = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
        if (k === "pattern") pending.pattern = value;
        if (k === "reason") pending.reason = value;
      }
    } else if (line.startsWith("    ")) {
      const kv = line.trim().match(/^(\w+)\s*:\s*(.*)$/);
      if (kv) {
        const [, k, v] = kv;
        const value = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
        if (k === "pattern") pending.pattern = value;
        if (k === "reason") pending.reason = value;
      }
    }
  }
  flush();
  return rules;
}

/* --------------------------- routes --------------------------- */

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    repoPath: REPO_PATH,
    sessionsDir: SESSIONS_DIR,
    hasContract: fs.existsSync(CONTRACT_PATH),
    hasLog: fs.existsSync(LOG_PATH),
  });
});

/** List sessions — minimal summary the dashboard list view needs. */
app.get("/api/sessions", (_req, res) => {
  const files = listSessionFiles();
  const summaries = files
    .map((file) => {
      const data = readJson<any>(file);
      if (!data?.evidenceBundle) return null;
      const b = data.evidenceBundle;
      const actions = Array.isArray(b.actions) ? b.actions : [];
      return {
        id: b.id ?? b.sessionId ?? path.basename(file, ".json"),
        task: b.task ?? "(no task)",
        repoPath: b.repoPath,
        branch: b.branch,
        baseCommit: b.baseCommit,
        endCommit: b.endCommit,
        startedAt: b.startedAt,
        finishedAt: b.finishedAt,
        status: b.status ?? "finished",
        changedFiles: b.changedFiles ?? [],
        actionCount: actions.length,
        memoryCardCount: data.report?.memoryCards?.length ?? 0,
        file,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));

  res.json(summaries);
});

/** Full SessionFile. */
app.get("/api/sessions/:id", (req, res) => {
  const id = req.params.id;
  const files = listSessionFiles();
  for (const file of files) {
    const data = readJson<any>(file);
    if (!data?.evidenceBundle) continue;
    if ((data.evidenceBundle.id ?? data.evidenceBundle.sessionId) === id) {
      return res.json(data);
    }
  }
  res.status(404).json({ error: "session not found", id });
});

/** Stored memories. */
app.get("/api/memories", async (req, res, next) => {
  try {
    const sessionId =
      typeof req.query.sessionId === "string" && req.query.sessionId.length > 0
        ? req.query.sessionId
        : undefined;
    const memories = await loadMemories(sessionId);
    res.json(memories);
  } catch (err) {
    next(err);
  }
});

/** Retrieve relevant memories for a new task. */
app.post("/api/context", async (req, res, next) => {
  try {
    const task = String(req.body?.task ?? "").trim();
    if (!task) return res.status(400).json({ error: "task required" });
    const limit = typeof req.body?.limit === "number" ? req.body.limit : 5;
    const result = await getContextForTask({ task, limit }, WITSMITH_DIR);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Re-hash source files and mark stale memories. */
app.post("/api/stale-check", async (_req, res, next) => {
  try {
    const result = await runStaleCheck(REPO_PATH);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Import a session JSON into the DB and generate memory cards. */
app.post("/api/import-session", async (req, res, next) => {
  try {
    const relOrAbs: string = req.body?.path ?? "";
    if (!relOrAbs) return res.status(400).json({ error: "path required" });
    const file = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(SESSIONS_DIR, relOrAbs);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "file not found", file });
    const cards = await importSession(file);
    res.json({ imported: cards.length, cards });
  } catch (err) {
    next(err);
  }
});

/** Parsed AGENT_WIT.yaml. */
app.get("/api/safety/rules", (_req, res) => {
  if (!fs.existsSync(CONTRACT_PATH)) {
    return res.json({ source: CONTRACT_PATH, rules: [], missing: true });
  }
  const text = fs.readFileSync(CONTRACT_PATH, "utf-8");
  res.json({ source: CONTRACT_PATH, rules: parseContract(text), missing: false });
});

/** Tail of .witsmith/log.jsonl. */
app.get("/api/safety/events", (req, res) => {
  if (!fs.existsSync(LOG_PATH)) return res.json([]);
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
  const text = fs.readFileSync(LOG_PATH, "utf-8");
  const events = text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse()
    .slice(0, limit);
  res.json(events);
});

/* --------------------------- error handling --------------------------- */

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[backend]", err);
  res.status(500).json({ error: err.message ?? "internal error" });
});

app.listen(PORT, () => {
  console.log(`[witsmith-backend] listening on http://localhost:${PORT}`);
  console.log(`  repo: ${REPO_PATH}`);
  console.log(`  sessions dir: ${SESSIONS_DIR}`);
  console.log(`  contract: ${CONTRACT_PATH} ${fs.existsSync(CONTRACT_PATH) ? "[found]" : "[missing]"}`);
  console.log(`  log:      ${LOG_PATH} ${fs.existsSync(LOG_PATH) ? "[found]" : "[missing]"}`);
});
