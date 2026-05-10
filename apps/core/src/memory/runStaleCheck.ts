import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";
import { prisma } from "../db/client";
import { MemoryCard } from "../types";
import { loadMemories, markStale } from "./storeMemories";

function hashFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return null;
  }
}

export async function runStaleCheck(repoPath: string): Promise<{
  checked: number;
  staleCount: number;
  stalledMemories: MemoryCard[];
}> {
  const memories = await loadMemories();
  const nonStale = memories.filter((m) => !m.isStale);
  const stalledMemories: MemoryCard[] = [];

  for (const memory of nonStale) {
    let becameStale = false;

    for (const relPath of memory.staleIfChanged) {
      const stored = await prisma.sourceFileHash.findFirst({
        where: { sessionId: memory.sessionId, filePath: relPath },
      });

      if (!stored) continue;

      const absPath = path.join(repoPath, relPath);
      const currentHash = hashFile(absPath);

      // file deleted or hash changed → stale
      if (currentHash === null || currentHash !== stored.hash) {
        becameStale = true;
        break;
      }
    }

    if (becameStale) {
      await markStale(memory.id);
      stalledMemories.push({ ...memory, isStale: true });
    }
  }

  return {
    checked: nonStale.length,
    staleCount: stalledMemories.length,
    stalledMemories,
  };
}
