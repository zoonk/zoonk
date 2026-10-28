import { z } from "zod";

/** The database's `MemoryCategory` values: this package doesn't depend on the database. */
const MEMORY_CATEGORIES = [
  "goals",
  "background",
  "routine",
  "preferences",
  "learning",
  "context",
] as const;

export const memoryCategorySchema = z.enum(MEMORY_CATEGORIES);

export type MemoryFactCategory = z.infer<typeof memoryCategorySchema>;

/** Never ids, which a model could echo or be tricked into picking. */
export type MemoryFactText = { category: MemoryFactCategory; statement: string };

export function formatMemoryFact(fact: MemoryFactText): string {
  return `[${fact.category}] ${fact.statement}`;
}

/** Decisions point at a fact by number ("replace_2"), so the model never sees a database id. */
export function formatMemoryFactList(facts: readonly MemoryFactText[]): string {
  if (facts.length === 0) {
    return "none";
  }

  return facts.map((fact, index) => `${index + 1}. ${formatMemoryFact(fact)}`).join("\n");
}
