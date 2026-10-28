import { type CourseLevel } from "../../../../generated/prisma/client";
import { type Localized } from "../_utils/localize";
import { type SeedLesson, type SeedSkill } from "./types";

type SkillText = Pick<SeedSkill, "description" | "example" | "name" | "useCase">;

export function skill(
  key: string,
  level: CourseLevel | null,
  text: SkillText,
  graph: Pick<SeedSkill, "hard" | "prerequisites"> = {},
): SeedSkill {
  return { ...graph, ...text, key, level };
}

export function outlineLesson(
  key: string,
  text: { title: Localized; description: Localized },
  skills: readonly string[],
  minutes = 4,
): SeedLesson {
  return { description: text.description, key, minutes, skills, title: text.title };
}

export function option(id: string, text: Localized, reason: Localized, isCorrect = false) {
  return { id, isCorrect, reason, text };
}

export function guess(id: string, text: Localized, isCorrect = false) {
  return { id, isCorrect, text };
}

export function bankOption(
  text: Localized,
  reason: Localized,
  misconception: Localized | null = null,
) {
  return { isCorrect: misconception === null, misconception, reason, text };
}
