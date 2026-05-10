import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";
import { prisma } from "./client";
import { SessionFile, MemoryCard } from "../types";
import { analyzeBundle } from "../analysis/analyzeBundle";

function hashFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return null;
  }
}

function serializeArray(arr: string[]): string {
  return JSON.stringify(arr);
}

function readHandoffs(repoPath: string): string[] {
  const handoffsDir = path.join(repoPath, ".witsmith", "handoffs");
  if (!fs.existsSync(handoffsDir)) return [];
  return fs
    .readdirSync(handoffsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      try {
        return fs.readFileSync(path.join(handoffsDir, f), "utf-8").trim();
      } catch {
        return null;
      }
    })
    .filter((content): content is string => content !== null && content.length > 0);
}

export async function importSession(sessionJsonPath: string): Promise<MemoryCard[]> {
  const raw = fs.readFileSync(sessionJsonPath, "utf-8");
  const sessionFile: SessionFile = JSON.parse(raw);
  const bundle = sessionFile.evidenceBundle;

  const handoffs = readHandoffs(bundle.repoPath);

  // upsert session row
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
      changedFiles: serializeArray(bundle.changedFiles),
      diff: bundle.diff,
      agentTrace: bundle.agentTrace,
      rawBundle: JSON.stringify(bundle),
    },
  });

  // generate memory cards via CLōD, enriched with any handoff notes
  const report = await analyzeBundle(bundle, handoffs);

  // store memory cards
  for (const card of report.memoryCards) {
    await prisma.memoryCard.upsert({
      where: { id: card.id },
      update: { isStale: card.isStale },
      create: {
        id: card.id,
        sessionId: (bundle.id ?? bundle.sessionId!),
        type: card.type,
        claimType: card.claimType,
        content: card.content,
        evidence: serializeArray(card.evidence),
        sourceFiles: serializeArray(card.sourceFiles),
        confidence: card.confidence,
        retrieveWhen: serializeArray(card.retrieveWhen),
        staleIfChanged: serializeArray(card.staleIfChanged),
        isStale: card.isStale,
        createdAt: new Date(card.createdAt),
      },
    });
  }

  // store source file hashes for stale detection
  const allSourceFiles = Array.from(
    new Set(report.memoryCards.flatMap((c) => c.staleIfChanged))
  );

  for (const relPath of allSourceFiles) {
    const absPath = path.join(bundle.repoPath, relPath);
    const hash = hashFile(absPath);
    if (!hash) continue;

    await prisma.sourceFileHash.upsert({
      where: { sessionId_filePath: { sessionId: (bundle.id ?? bundle.sessionId!), filePath: relPath } },
      update: { hash },
      create: { sessionId: (bundle.id ?? bundle.sessionId!), filePath: relPath, hash },
    });
  }

  return report.memoryCards;
}
