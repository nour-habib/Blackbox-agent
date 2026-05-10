import { prisma } from "../db/client";
import { MemoryCard } from "../types";

function parseArray(val: string): string[] {
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function dbRowToMemoryCard(row: {
  id: string;
  sessionId: string;
  type: string;
  claimType: string;
  content: string;
  evidence: string;
  sourceFiles: string;
  confidence: string;
  retrieveWhen: string;
  staleIfChanged: string;
  isStale: boolean;
  createdAt: Date;
}): MemoryCard {
  return {
    id: row.id,
    sessionId: row.sessionId,
    type: row.type as MemoryCard["type"],
    claimType: row.claimType as MemoryCard["claimType"],
    content: row.content,
    evidence: parseArray(row.evidence),
    sourceFiles: parseArray(row.sourceFiles),
    confidence: row.confidence as MemoryCard["confidence"],
    retrieveWhen: parseArray(row.retrieveWhen),
    staleIfChanged: parseArray(row.staleIfChanged),
    isStale: row.isStale,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function loadMemories(sessionId?: string): Promise<MemoryCard[]> {
  const rows = await prisma.memoryCard.findMany({
    where: sessionId ? { sessionId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(dbRowToMemoryCard);
}

export async function markStale(memoryCardId: string): Promise<void> {
  await prisma.memoryCard.update({
    where: { id: memoryCardId },
    data: { isStale: true },
  });
}
