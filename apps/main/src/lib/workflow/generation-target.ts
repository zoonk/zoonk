/**
 * Identifies the resource whose content the API should generate.
 */
export type GenerationTarget =
  | { id: string; type: "chapter" }
  | { id: string; type: "coursePrompt" }
  | { id: string; type: "lesson" };
