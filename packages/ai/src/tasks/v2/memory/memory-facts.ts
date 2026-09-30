import { z } from "zod";

/** The database's `MemoryCategory` values; this package doesn't depend on the database. */
export const MEMORY_CATEGORIES = [
  "goals",
  "background",
  "routine",
  "preferences",
  "learning",
  "context",
] as const;

export const memoryCategorySchema = z.enum(MEMORY_CATEGORIES);

export type MemoryFactCategory = z.infer<typeof memoryCategorySchema>;

/** What a model reads about one fact: never ids, which a model could echo or be tricked into picking. */
export type MemoryFactText = { category: MemoryFactCategory; statement: string };

export function formatMemoryFact(fact: MemoryFactText): string {
  return `[${fact.category}] ${fact.statement}`;
}

/**
 * Numbers facts from 1 so decisions can point at one ("replace_2") without the model ever seeing a
 * database id.
 */
export function formatMemoryFactList(facts: readonly MemoryFactText[]): string {
  if (facts.length === 0) {
    return "none";
  }

  return facts.map((fact, index) => `${index + 1}. ${formatMemoryFact(fact)}`).join("\n");
}
