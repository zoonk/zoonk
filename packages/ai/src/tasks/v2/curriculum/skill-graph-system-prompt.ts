import { selectPromptVariants } from "../../_utils/prompt-variants";
import template from "./skill-graph.prompt.md";

/**
 * The skill graph's instructions for one goal: the rules every graph follows, plus only those of
 * its kind (an exam's areas, depth and sections; a learn goal's purposes; a language's situations)
 * and, for a test from the learner's own material, those of its material and its lesson budget. A
 * learn goal never reads an exam's rules, and every call of one exam's graph reads the same text.
 */
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
