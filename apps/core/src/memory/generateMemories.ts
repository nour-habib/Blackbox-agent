import { EvidenceBundle, Claim, MemoryCard } from "../types";
import { generateMemoryCardsWithClod } from "../sponsors/clod";
import { indexMemoriesWithNia } from "../sponsors/nia";

export async function generateMemoryCards(
  bundle: EvidenceBundle,
  claims: Claim[],
  summary: string,
  handoffs: string[] = []
): Promise<MemoryCard[]> {
  const cards = await generateMemoryCardsWithClod(bundle, claims, summary, handoffs);
  await indexMemoriesWithNia(cards);
  return cards;
}
