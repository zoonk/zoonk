import { selectPromptVariants } from "../_utils/prompt-variants";
import { writesExamExtras } from "./_utils/skill-graph-extras";
import { hasWrittenOptions } from "./exam-outline";
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
  examBlueprint,
  firstSkill,
  goalKind,
  hasMaterial = false,
  lessonBudget,
  librarySkills = false,
  ownLevel,
  product,
  purpose,
}: Pick<
  SkillGraphParams,
  | "examBlueprint"
  | "firstSkill"
  | "goalKind"
  | "hasMaterial"
  | "lessonBudget"
  | "librarySkills"
  | "ownLevel"
  | "product"
  | "purpose"
>): string {
  return selectPromptVariants({
    template,
    variants: {
      budget: Boolean(lessonBudget),
      domainShares: Boolean(examBlueprint?.subjects.some((subject) => subject.topicGroups?.length)),
      exam: goalKind === "exam",
      extras: writesExamExtras({ goalKind, hasMaterial, lessonBudget }),
      firstSkill: goalKind === "learn" && Boolean(firstSkill),
      language: goalKind === "language",
      learn: goalKind === "learn",
      librarySkills: goalKind === "exam" && librarySkills,
      material: hasMaterial,
      product: Boolean(product),
      subjectStart: startsWithSubject({ goalKind, hasMaterial, ownLevel, purpose }),
      writtenOptions: hasWrittenOptions(examBlueprint),
    },
  });
}
