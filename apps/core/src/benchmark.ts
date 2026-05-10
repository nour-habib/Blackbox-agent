import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { SessionFile, EvidenceBundle, Claim, MemoryCard } from "./types";
import { buildObservedClaims, buildAgentReportedClaims, buildInferredClaims } from "./analysis/buildClaims";
import { detectFailureModes } from "./analysis/detectFailureModes";
import { summarizeWithClod, inferHypothesesWithClod, generateMemoryCardsWithClod } from "./sponsors/clod";
import { indexMemoriesWithNia } from "./sponsors/nia";
import { keywordSearch } from "./memory/keywordSearch";
import { runStaleCheck } from "./memory/runStaleCheck";
import { prisma } from "./db/client";

// ─── types ────────────────────────────────────────────────────────────────────

type StepStatus = "ok" | "fallback" | "error";

interface StepResult {
  step: string;
  service: string;
  latencyMs: number;
  status: StepStatus;
  outputSummary: string;
  note?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function time<T>(
  fn: () => Promise<T>
): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: Math.round(performance.now() - start) };
}

function qualityScore(text: string): string {
  const words = text.trim().split(/\s+/).length;
  return `${words} words`;
}

function row(r: StepResult): void {
  const icon = r.status === "ok" ? "✓" : r.status === "fallback" ? "↩" : "✗";
  const note = r.note ? ` (${r.note})` : "";
  console.log(
    `  ${icon}  ${r.step.padEnd(30)} ${r.service.padEnd(18)} ${String(r.latencyMs + "ms").padEnd(10)} ${r.outputSummary}${note}`
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const MOCK = path.resolve(__dirname, "../mock/session.example.json");
  const WITSMITH_DIR = path.resolve(__dirname, "../mock");
  const CONTEXT_TASK = "Add refresh-token validation";

  const results: StepResult[] = [];
  const pipelineStart = performance.now();

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Blackbox core — benchmark run");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Session:  ${path.basename(MOCK)}`);
  console.log(`  Task:     "${CONTEXT_TASK}"`);
  console.log("══════════════════════════════════════════════════════\n");

  // ── Step 1: Parse session JSON ───────────────────────────────────────────
  const { result: sessionFile, ms: parseMs } = await time(async () => {
    const raw = fs.readFileSync(MOCK, "utf-8");
    return JSON.parse(raw) as SessionFile;
  });
  const bundle: EvidenceBundle = sessionFile.evidenceBundle;
  results.push({
    step: "Parse session JSON",
    service: "local",
    latencyMs: parseMs,
    status: "ok",
    outputSummary: `${bundle.changedFiles.length} changed files, ${bundle.actions.length} actions`,
  });

  // ── Step 2: Summarize (CLōD) ────────────────────────────────────────────
  const { result: summary, ms: summarizeMs } = await time(() => summarizeWithClod(bundle));
  results.push({
    step: "Summarize session",
    service: "CLōD/haiku",
    latencyMs: summarizeMs,
    status: "ok",
    outputSummary: qualityScore(summary),
  });

  // ── Step 3: Infer hypotheses (CLōD) ─────────────────────────────────────
  const { result: hypotheses, ms: inferMs } = await time(() => inferHypothesesWithClod(bundle));
  results.push({
    step: "Infer hypotheses",
    service: "CLōD/haiku",
    latencyMs: inferMs,
    status: "ok",
    outputSummary: `${hypotheses.length} hypotheses`,
  });

  // ── Step 4: Build claims (local) ─────────────────────────────────────────
  const { result: claims, ms: claimsMs } = await time(async () => {
    const observed = buildObservedClaims(bundle);
    const agentReported = buildAgentReportedClaims(bundle);
    const inferred = buildInferredClaims(bundle, hypotheses);
    return [...observed, ...agentReported, ...inferred] as Claim[];
  });
  results.push({
    step: "Build claims",
    service: "local",
    latencyMs: claimsMs,
    status: "ok",
    outputSummary: `${claims.length} claims (${claims.filter(c => c.kind === "observed").length} observed, ${claims.filter(c => c.kind === "inferred").length} inferred)`,
  });

  // ── Step 5: Detect failure modes (local) ─────────────────────────────────
  const { result: failureModes, ms: failureMs } = await time(async () =>
    detectFailureModes(bundle.actions)
  );
  results.push({
    step: "Detect failure modes",
    service: "local",
    latencyMs: failureMs,
    status: "ok",
    outputSummary: failureModes.length > 0 ? failureModes.join(", ") : "none detected",
  });

  // ── Step 6: Generate memory cards (CLōD) ─────────────────────────────────
  let cards: MemoryCard[] = [];
  let cardsStatus: StepStatus = "ok";
  const { ms: cardsMs } = await time(async () => {
    try {
      cards = await generateMemoryCardsWithClod(bundle, claims, summary);
    } catch (e) {
      cardsStatus = "error";
      console.error("  [CLōD] generateMemoryCards failed:", e);
    }
  });
  results.push({
    step: "Generate memory cards",
    service: "CLōD",
    latencyMs: cardsMs,
    status: cardsStatus,
    outputSummary: `${cards.length} cards generated`,
  });

  // ── Step 7: Index with Nia ────────────────────────────────────────────────
  let niaIndexStatus: StepStatus = "ok";
  let niaNote: string | undefined;
  const { ms: niaIndexMs } = await time(async () => {
    try {
      await indexMemoriesWithNia(cards);
    } catch (e) {
      niaIndexStatus = "error";
      niaNote = String(e);
    }
  });
  results.push({
    step: "Index with Nia",
    service: "Nia",
    latencyMs: niaIndexMs,
    status: niaIndexStatus,
    outputSummary: niaIndexStatus === "ok" ? `${cards.length} cards indexed` : "failed",
    note: niaNote,
  });

  // ── Step 8: Store in SQLite ───────────────────────────────────────────────
  const { ms: dbMs } = await time(async () => {
    await prisma.session.upsert({
      where: { id: (bundle.id ?? bundle.sessionId!) },
      update: {},
      create: {
        id: (bundle.id ?? bundle.sessionId!),
        task: bundle.task,
        repoPath: bundle.repoPath,
        branch: bundle.branch,
        baseCommit: bundle.baseCommit,
        endCommit: bundle.endCommit,
        startedAt: new Date(bundle.startedAt),
        finishedAt: new Date(bundle.finishedAt),
        status: bundle.status,
        changedFiles: JSON.stringify(bundle.changedFiles),
        diff: bundle.diff,
        agentTrace: bundle.agentTrace,
        rawBundle: JSON.stringify(bundle),
      },
    });
    for (const card of cards) {
      await prisma.memoryCard.upsert({
        where: { id: card.id },
        update: { isStale: card.isStale },
        create: {
          id: card.id,
          sessionId: (bundle.id ?? bundle.sessionId!),
          type: card.type,
          claimType: card.claimType,
          content: card.content,
          evidence: JSON.stringify(card.evidence),
          sourceFiles: JSON.stringify(card.sourceFiles),
          confidence: card.confidence,
          retrieveWhen: JSON.stringify(card.retrieveWhen),
          staleIfChanged: JSON.stringify(card.staleIfChanged),
          isStale: card.isStale,
          createdAt: new Date(card.createdAt),
        },
      });
    }
  });
  results.push({
    step: "Store in SQLite",
    service: "Prisma/SQLite",
    latencyMs: dbMs,
    status: "ok",
    outputSummary: `1 session + ${cards.length} cards written`,
  });

  // ── Step 9: Get context for task ─────────────────────────────────────────
  let retrievedCards: MemoryCard[] = [];

  const { ms: contextMs } = await time(async () => {
    const allMemories = cards.filter((m) => !m.isStale);
    retrievedCards = keywordSearch(allMemories, CONTEXT_TASK);
  });
  results.push({
    step: "Get context for task",
    service: "keyword search",
    latencyMs: contextMs,
    status: "ok",
    outputSummary: `${retrievedCards.length} memories retrieved`,
  });

  // ── Step 10: Stale check ─────────────────────────────────────────────────
  const { result: staleResult, ms: staleMs } = await time(async () =>
    runStaleCheck(process.cwd())
  );
  results.push({
    step: "Stale check",
    service: "local/SQLite",
    latencyMs: staleMs,
    status: "ok",
    outputSummary: `${staleResult.checked} checked, ${staleResult.staleCount} stale`,
  });

  const totalMs = Math.round(performance.now() - pipelineStart);

  // ── Print results table ──────────────────────────────────────────────────
  console.log("  Step                           Service            Latency    Output");
  console.log("  " + "─".repeat(80));
  results.forEach(row);
  console.log("  " + "─".repeat(80));
  console.log(`  ${"TOTAL PIPELINE".padEnd(30)} ${"".padEnd(18)} ${String(totalMs + "ms").padEnd(10)}`);

  // ── Print outputs for quality review ────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Quality review");
  console.log("══════════════════════════════════════════════════════");
  console.log(`\n  Summary:\n  "${summary}"\n`);
  console.log(`  Hypotheses (${hypotheses.length}):`);
  hypotheses.forEach((h, i) => console.log(`    ${i + 1}. ${h}`));
  console.log(`\n  Memory cards (${cards.length}):`);
  cards.forEach((c, i) =>
    console.log(`    ${i + 1}. [${c.type}/${c.confidence}] ${c.content.slice(0, 100)}`)
  );
  console.log(`\n  Retrieved for "${CONTEXT_TASK}" (${retrievedCards.length}):`);
  retrievedCards.slice(0, 3).forEach((c, i) =>
    console.log(`    ${i + 1}. ${c.content.slice(0, 100)}`)
  );

  console.log("\n══════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
