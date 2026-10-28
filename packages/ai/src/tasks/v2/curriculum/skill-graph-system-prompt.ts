import { selectPromptVariants } from "../../_utils/prompt-variants";
import template from "./skill-graph.prompt.md";

/** Every call of one exam's graph reads the same text, so they share a cached prefix. */
export function buildSkillGraphSystemPrompt({
  goalKind,
  hasMaterial = false,
  lessonBudget,
}: {
  goalKind: "learn" | "exam" | "language";
  hasMaterial?: boolean;
  lessonBudget?: number | null;
}): string {
  return selectPromptVariants({
    template,
    variants: {
      budget: Boolean(lessonBudget),
      exam: goalKind === "exam",
      language: goalKind === "language",
      learn: goalKind === "learn",
      material: hasMaterial,
    },
  });
}
