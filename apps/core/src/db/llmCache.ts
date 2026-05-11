import * as crypto from "crypto";
import { prisma } from "./client";

// In-memory layer — avoids DB roundtrip within the same process
const memoryCache = new Map<string, string>();

function cacheKey(model: string, prompt: string): string {
  return crypto.createHash("sha256").update(model + prompt).digest("hex");
}

export async function getCached(model: string, prompt: string): Promise<string | null> {
  const key = cacheKey(model, prompt);

  // 1. check in-memory first
  const memHit = memoryCache.get(key);
  if (memHit !== undefined) return memHit;

  // 2. fall through to SQLite
  const hit = await prisma.llmCache.findUnique({ where: { key } });
  if (!hit) return null;

  // warm the in-memory layer for next call
  memoryCache.set(key, hit.response);

  await prisma.llmCache.update({
    where: { key },
    data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
  });

  return hit.response;
}

export async function setCached(model: string, prompt: string, response: string): Promise<void> {
  const key = cacheKey(model, prompt);
  memoryCache.set(key, response);

  await prisma.llmCache.upsert({
    where: { key },
    update: { response, lastHitAt: new Date() },
    create: { key, model, response },
  });
}
