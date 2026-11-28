import { fillPromptLanguages } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { writesExamExtras } from "./_utils/skill-graph-extras";
import { type SkillGraphParams } from "./skill-graph-calls";
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
  firstSkill,
  goalKind,
  hasMaterial = false,
  language,
  lessonBudget,
  librarySkills = false,
  ownLevel,
  product,
  purpose,
  targetLanguage,
}: Pick<
  SkillGraphParams,
  | "firstSkill"
  | "goalKind"
  | "hasMaterial"
  | "language"
  | "lessonBudget"
  | "librarySkills"
  | "ownLevel"
  | "product"
  | "purpose"
  | "targetLanguage"
>): string {
  const variants = selectPromptVariants({
    template,
    variants: {
      budget: Boolean(lessonBudget),
      exam: goalKind === "exam",
      extras: writesExamExtras({ goalKind, hasMaterial, lessonBudget }),
      firstSkill: goalKind === "learn" && Boolean(firstSkill),
      language: goalKind === "language",
      learn: goalKind === "learn",
      librarySkills: goalKind === "exam" && librarySkills,
      material: hasMaterial,
      product: Boolean(product),
      subjectStart: startsWithSubject({ goalKind, hasMaterial, ownLevel, purpose }),
    },
  });

  return fillPromptLanguages({
    learnerLanguage: language,
    targetLanguage,
    template: variants,
  }).replaceAll("{{TARGET_LANGUAGE}}", "the language GOAL names");
}
