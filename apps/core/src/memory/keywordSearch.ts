import { MemoryCard } from "../types";

export function keywordSearch(memories: MemoryCard[], task: string): MemoryCard[] {
  const tokens = task.toLowerCase().split(/\W+/).filter(Boolean);

  return memories
    .filter((m) => !m.isStale)
    .map((m) => {
      const hits = tokens.filter((t) =>
        m.retrieveWhen.some((kw) => kw.toLowerCase().includes(t) || t.includes(kw.toLowerCase()))
      );
      return { memory: m, score: hits.length };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ memory }) => memory);
}
