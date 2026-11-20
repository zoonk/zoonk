import { type ScoreCategory } from "@/lib/types";

export type ReadCriterion = Pick<ScoreCategory, "expectations" | "id" | "label">;

export const PLAIN_LANGUAGE_CRITERION: ReadCriterion = {
  expectations: `A person with no background in the subject follows it on the first read: everyday words, short sentences, and examples from everyday life they've seen or done, with a technical term only after the plain idea it names. Ask whether a grandmother would understand it. An output that is accurate but reads academic, abstract or dull fails its reader as surely as a wrong fact does: they stop reading or don't take it in. Notice jargon left unexplained, definitions before any example, abstract nouns where a concrete case fits, generic examples ("a company", "a person"), and a tone that reads like a textbook. A term the reader already knows for their goal is fine.`,
  id: "plainLanguage",
  label: "Easy to follow",
};

export function readCriteria(
  categories: readonly ReadCriterion[],
  ...extra: ReadCriterion[]
): ReadCriterion[] {
  return [
    ...categories.map(({ expectations, id, label }) => ({ expectations, id, label })),
    ...extra,
  ];
}
