export const ACTIVITY_OPTIONS_COUNT = 4;

export function formatConceptLines(concepts: string[], neighboringConcepts: string[]) {
  return `CONCEPTS: ${concepts.join(", ")}
NEIGHBORING_CONCEPTS: ${neighboringConcepts.join(", ")}`;
}
