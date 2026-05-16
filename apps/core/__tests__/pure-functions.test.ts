import { keywordSearch } from "../src/memory/keywordSearch";
import { detectFailureModes } from "../src/analysis/detectFailureModes";
import { buildObservedClaims, buildAgentReportedClaims, buildInferredClaims } from "../src/analysis/buildClaims";
import { recommendAmendments } from "../src/analysis/recommendAmendments";
import { EvidenceBundle, MemoryCard, ActionEvent } from "../src/types";

// ─── fixtures ─────────────────────────────────────────────────────────────────

function makeAction(overrides: Partial<ActionEvent> = {}): ActionEvent {
  return {
    action_id: "act_001",
    ts: "2026-05-10T00:00:00.000Z",
    command: "npm test",
    cwd: "/repo",
    source: "user",
    decision: "allow",
    executed: true,
    exit_code: 0,
    stdout: "",
    stderr: "",
    ...overrides,
  };
}

function makeBundle(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    id: "session_test",
    task: "Fix OAuth redirect bug",
    repoPath: "/repo",
    branch: "main",
    baseCommit: "abc123",
    endCommit: "abc124",
    startedAt: "2026-05-10T14:00:00.000Z",
    finishedAt: "2026-05-10T14:30:00.000Z",
    status: "finished",
    changedFiles: ["src/auth/callback.ts", "tests/auth.test.ts"],
    diff: "diff --git a/src/auth/callback.ts...",
    actions: [makeAction()],
    agentTrace: "## Final summary\n- Fixed expiry bug",
    ...overrides,
  };
}

function makeMemoryCard(overrides: Partial<MemoryCard> = {}): MemoryCard {
  return {
    id: "memory_001",
    sessionId: "session_test",
    type: "risk",
    claimType: "observed",
    content: "OAuth expiry mismatch between callback and session modules",
    evidence: ["git diff shows change"],
    sourceFiles: ["src/auth/callback.ts"],
    confidence: "high",
    retrieveWhen: ["oauth", "auth", "expiry", "token", "callback"],
    staleIfChanged: ["src/auth/callback.ts"],
    isStale: false,
    createdAt: "2026-05-10T14:30:00.000Z",
    ...overrides,
  };
}

// ─── keywordSearch ─────────────────────────────────────────────────────────────

describe("keywordSearch", () => {
  const memories = [
    makeMemoryCard({ id: "m1", retrieveWhen: ["oauth", "auth", "expiry", "token"] }),
    makeMemoryCard({ id: "m2", retrieveWhen: ["prisma", "migration", "database", "schema"] }),
    makeMemoryCard({ id: "m3", retrieveWhen: ["test", "jest", "coverage", "unit"] }),
  ];

  it("returns cards matching task keywords", () => {
    const results = keywordSearch(memories, "Add refresh-token validation");
    expect(results.map((r) => r.id)).toContain("m1");
  });

  it("ranks more keyword matches higher", () => {
    const results = keywordSearch(memories, "oauth token expiry auth");
    expect(results[0].id).toBe("m1");
  });

  it("returns empty array when no keywords match", () => {
    const results = keywordSearch(memories, "kubernetes deployment scaling");
    expect(results).toHaveLength(0);
  });

  it("excludes stale memories", () => {
    const withStale = [
      makeMemoryCard({ id: "m1", retrieveWhen: ["oauth"], isStale: false }),
      makeMemoryCard({ id: "m2", retrieveWhen: ["oauth"], isStale: true }),
    ];
    const results = keywordSearch(withStale, "oauth");
    expect(results.map((r) => r.id)).toEqual(["m1"]);
  });

  it("returns empty array for empty memory list", () => {
    expect(keywordSearch([], "oauth token")).toHaveLength(0);
  });
});

// ─── detectFailureModes ────────────────────────────────────────────────────────

describe("detectFailureModes", () => {
  it("detects docs_source_mismatch", () => {
    const actions = [makeAction({ exit_code: 1, stdout: "docs mismatch found in oauth module" })];
    expect(detectFailureModes(actions)).toContain("docs_source_mismatch");
  });

  it("detects assertion_failure", () => {
    const actions = [makeAction({ exit_code: 1, stdout: "Expected 10, received 30" })];
    expect(detectFailureModes(actions)).toContain("assertion_failure");
  });

  it("detects missing_dependency", () => {
    const actions = [makeAction({ exit_code: 1, stderr: "Cannot find module 'express'" })];
    expect(detectFailureModes(actions)).toContain("missing_dependency");
  });

  it("detects database_migration", () => {
    const actions = [makeAction({ exit_code: 1, stdout: "migration failed on schema change" })];
    expect(detectFailureModes(actions)).toContain("database_migration");
  });

  it("returns unknown_failure when no pattern matches", () => {
    const actions = [makeAction({ exit_code: 1, stdout: "something went wrong" })];
    expect(detectFailureModes(actions)).toContain("unknown_failure");
  });

  it("returns empty array when all actions pass", () => {
    const actions = [makeAction({ exit_code: 0 }), makeAction({ exit_code: 0 })];
    expect(detectFailureModes(actions)).toHaveLength(0);
  });

  it("ignores non-executed actions", () => {
    const actions = [makeAction({ executed: false, exit_code: 1 })];
    expect(detectFailureModes(actions)).toHaveLength(0);
  });
});

// ─── buildClaims ──────────────────────────────────────────────────────────────

describe("buildObservedClaims", () => {
  it("creates a claim for changed files", () => {
    const bundle = makeBundle({ changedFiles: ["src/auth/callback.ts"] });
    const claims = buildObservedClaims(bundle);
    expect(claims.some((c) => c.text.includes("src/auth/callback.ts"))).toBe(true);
  });

  it("creates a claim for each failed action", () => {
    const bundle = makeBundle({
      actions: [makeAction({ exit_code: 1, command: "npm test", stdout: "1 failed" })],
    });
    const claims = buildObservedClaims(bundle);
    expect(claims.some((c) => c.text.includes("npm test"))).toBe(true);
    expect(claims.some((c) => c.kind === "observed")).toBe(true);
  });

  it("all claims have high confidence", () => {
    const claims = buildObservedClaims(makeBundle());
    claims.forEach((c) => expect(c.confidence).toBe("high"));
  });

  it("returns empty array when no files changed and no failures", () => {
    const bundle = makeBundle({ changedFiles: [], actions: [] });
    expect(buildObservedClaims(bundle)).toHaveLength(0);
  });
});

describe("buildAgentReportedClaims", () => {
  it("returns a claim when agent trace is present", () => {
    const bundle = makeBundle({ agentTrace: "## Final summary\n- Fixed the bug" });
    const claims = buildAgentReportedClaims(bundle);
    expect(claims).toHaveLength(1);
    expect(claims[0].kind).toBe("agent_reported");
    expect(claims[0].confidence).toBe("medium");
  });

  it("returns empty array when agent trace is empty", () => {
    const bundle = makeBundle({ agentTrace: "" });
    expect(buildAgentReportedClaims(bundle)).toHaveLength(0);
  });
});

describe("buildInferredClaims", () => {
  it("wraps llm inferences as inferred claims", () => {
    const inferences = ["Docs and source diverged on expiry", "Magic numbers caused the bug"];
    const claims = buildInferredClaims(makeBundle(), inferences);
    expect(claims).toHaveLength(2);
    claims.forEach((c) => {
      expect(c.kind).toBe("inferred");
      expect(c.confidence).toBe("medium");
    });
  });

  it("returns empty array for empty inferences", () => {
    expect(buildInferredClaims(makeBundle(), [])).toHaveLength(0);
  });
});

// ─── recommendAmendments ──────────────────────────────────────────────────────

describe("recommendAmendments", () => {
  it("recommends amendment for prisma migrate", () => {
    const bundle = makeBundle({
      actions: [makeAction({ command: "npx prisma migrate dev" })],
    });
    const amendments = recommendAmendments(bundle);
    expect(amendments).toHaveLength(1);
    expect(amendments[0].status).toBe("suggested");
    expect(amendments[0].filePath).toBe(".witsmith/AGENT_WIT.yaml");
  });

  it("recommends amendment for rm -rf", () => {
    const bundle = makeBundle({
      actions: [makeAction({ command: "rm -rf node_modules" })],
    });
    const amendments = recommendAmendments(bundle);
    expect(amendments.some((a) => a.diff.includes("rm -rf node_modules"))).toBe(true);
  });

  it("recommends amendment for git push --force", () => {
    const bundle = makeBundle({
      actions: [makeAction({ command: "git push --force origin main" })],
    });
    const amendments = recommendAmendments(bundle);
    expect(amendments).toHaveLength(1);
  });

  it("returns empty array for safe commands", () => {
    const bundle = makeBundle({
      actions: [makeAction({ command: "npm test" }), makeAction({ command: "git status" })],
    });
    expect(recommendAmendments(bundle)).toHaveLength(0);
  });

  it("amendment includes the command as evidence", () => {
    const bundle = makeBundle({
      actions: [makeAction({ command: "npx prisma migrate dev", exit_code: 0 })],
    });
    const amendments = recommendAmendments(bundle);
    expect(amendments[0].evidence.some((e) => e.includes("npx prisma migrate dev"))).toBe(true);
  });
});
