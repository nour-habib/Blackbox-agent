import { execSync } from "child_process";
import { MemoryCard } from "../types";

// Nia by Nozomio is a CLI tool — it indexes codebases and docs, not custom memory cards.
// Correct use: search the actual repo for codebase context to enrich memory card evidence.
// Memory card retrieval uses keyword search (see keywordSearch.ts).

export function searchCodebaseWithNia(query: string, repoPath?: string): string | null {
  const apiKey = process.env.NIA_API_KEY;
  if (!apiKey) return null;

  try {
    const localFlag = repoPath ? `--local-folders "${repoPath}"` : "";
    const result = execSync(
      `nia search query "${query}" ${localFlag} --api-key ${apiKey}`,
      { encoding: "utf-8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] }
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}

// No-op kept for call-site compatibility — Nia doesn't index custom memory cards
export async function indexMemoriesWithNia(_memories: MemoryCard[]): Promise<void> {
  return;
}

// Memory card retrieval is handled by keywordSearch.ts — not Nia
// Nia is available as codebase context enrichment via searchCodebaseWithNia()
export async function queryNia(
  _task: string,
  memories: MemoryCard[]
): Promise<MemoryCard[]> {
  return memories;
}
