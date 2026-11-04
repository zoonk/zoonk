import { selectPromptVariants } from "../_utils/prompt-variants";
import { type SkillGraphParams } from "./skill-graph";
import template from "./skill-graph.prompt.md";

type SubjectStartParams = Pick<
  SkillGraphParams,
  "goalKind" | "hasMaterial" | "ownLevel" | "purpose"
>;

export function startsWithSubject({
  goalKind,
  hasMaterial,
  ownLevel,
  purpose,
}: SubjectStartParams): boolean {
  return (
    goalKind === "learn" &&
    purpose === "deep" &&
    (ownLevel === "none" || ownLevel === "basic") &&
    !hasMaterial
  );
}

/** Every call of one exam's graph reads the same text, so they share a cached prefix. */
export function buildSkillGraphSystemPrompt({
  goalKind,
  hasMaterial = false,
  lessonBudget,
  ownLevel,
  purpose,
}: Pick<
  SkillGraphParams,
  "goalKind" | "hasMaterial" | "lessonBudget" | "ownLevel" | "purpose"
>): string {
  return selectPromptVariants({
    template,
    variants: {
      budget: Boolean(lessonBudget),
      exam: goalKind === "exam",
      language: goalKind === "language",
      learn: goalKind === "learn",
      material: hasMaterial,
      subjectStart: startsWithSubject({ goalKind, hasMaterial, ownLevel, purpose }),
    },
  });
}
