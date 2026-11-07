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

/** An exam's skill is one ability whatever the exam's size, so exams that test it share it. */
function sizesSkillsByAbility({
  goalKind,
  hasMaterial = false,
  lessonBudget,
}: Pick<SkillGraphParams, "goalKind" | "hasMaterial" | "lessonBudget">): boolean {
  return goalKind === "exam" && !hasMaterial && !lessonBudget;
}

/** Every call of one exam's graph reads the same text, so they share a cached prefix. */
export function buildSkillGraphSystemPrompt({
  findLibrarySkills,
  goalKind,
  hasMaterial = false,
  lessonBudget,
  ownLevel,
  purpose,
}: Pick<
  SkillGraphParams,
  "findLibrarySkills" | "goalKind" | "hasMaterial" | "lessonBudget" | "ownLevel" | "purpose"
>): string {
  const examSkills = sizesSkillsByAbility({ goalKind, hasMaterial, lessonBudget });

  return selectPromptVariants({
    template,
    variants: {
      budget: Boolean(lessonBudget),
      exam: goalKind === "exam",
      examSkills,
      goalSizedSkills: !examSkills,
      language: goalKind === "language",
      learn: goalKind === "learn",
      librarySkills: goalKind === "exam" && Boolean(findLibrarySkills),
      material: hasMaterial,
      subjectStart: startsWithSubject({ goalKind, hasMaterial, ownLevel, purpose }),
    },
  });
}
