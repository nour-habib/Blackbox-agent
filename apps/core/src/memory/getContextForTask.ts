import * as fs from "fs";
import * as path from "path";
import { ContextRequest, ContextResult, MemoryCard } from "../types";
import { keywordSearch } from "./keywordSearch";
import { loadMemories } from "./storeMemories";

function buildContextBlock(memories: MemoryCard[]): string {
  if (memories.length === 0) return "No relevant Witsmith memories found.";

  const lines = memories.map((m) => {
    const staleTag = m.isStale ? " [STALE]" : "";
    const confidence = `[${m.confidence}]`;
    return `- ${confidence}${staleTag} ${m.content}`;
  });

  return `Relevant Witsmith memories:\n${lines.join("\n")}`;
}

export async function getContextForTask(
  request: ContextRequest,
  witsmithDir: string
): Promise<ContextResult> {
  const allMemories = await loadMemories();
  const fresh = allMemories.filter((m) => !m.isStale);
  const relevant = keywordSearch(fresh, request.task);

  const limit = request.limit ?? 5;
  const topMemories = relevant.slice(0, limit);
  const contextBlock = buildContextBlock(topMemories);

  // write .witsmith/context.md for Cursor to consume
  const contextPath = path.join(witsmithDir, "context.md");
  fs.writeFileSync(contextPath, `# Witsmith Context\n\nTask: ${request.task}\n\n${contextBlock}\n`);

  return { task: request.task, memories: topMemories, contextBlock };
}
