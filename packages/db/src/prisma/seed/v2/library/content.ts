import { type CourseLevel } from "../../../../generated/prisma/client";
import { type Localized } from "../_utils/localize";
import { type SeedLesson, type SeedSkill } from "./types";

type SkillText = Pick<SeedSkill, "description" | "example" | "name" | "useCase">;

/** A skill in the course graph. Written lessons add an example and a use case for the spec. */
export function skill(
  key: string,
  level: CourseLevel | null,
  text: SkillText,
  graph: Pick<SeedSkill, "hard" | "prerequisites"> = {},
): SeedSkill {
  return { ...graph, ...text, key, level };
}

/** A lesson in a chapter's outline, written on demand when a learner reaches it. */
export function outlineLesson(
  key: string,
  text: { title: Localized; description: Localized },
  skills: readonly string[],
  minutes = 4,
): SeedLesson {
  return { description: text.description, key, minutes, skills, title: text.title };
}

/** A multiple-choice option with the reason shown whichever option the learner picks. */
export function option(id: string, text: Localized, reason: Localized, isCorrect = false) {
  return { id, isCorrect, reason, text };
}

/** A hook option: the guess never counts, so it carries no reason. */
export function guess(id: string, text: Localized, isCorrect = false) {
  return { id, isCorrect, text };
}

/** A bank option: wrong ones name the misconception behind them. */
export function bankOption(
  text: Localized,
  reason: Localized,
  misconception: Localized | null = null,
) {
  return { isCorrect: misconception === null, misconception, reason, text };
}
