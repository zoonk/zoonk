import { type LearnerSkill, type MasteryState } from "@zoonk/db";
import { NEW_SKILL_MEMORY, getSkillRetrievability } from "../fsrs-scheduler";
import { isFadingRetrievability } from "../mastery-state";

export type SkillStatus = {
  due: Date | null;
  fading: boolean;
  recallDays: number;
  /** The chance of recalling it now; null when never studied. */
  retrievability: number | null;
  state: MasteryState;
  /** When the learner started learning it; null while New. */
  studiedAt: Date | null;
};

/** A missing learner row represents New. */
export function toSkillStatus({
  learnerSkill,
  now,
}: {
  learnerSkill: LearnerSkill | undefined;
  now: Date;
}): SkillStatus {
  const memory = learnerSkill ?? NEW_SKILL_MEMORY;
  const retrievability = getSkillRetrievability({ memory, now });

  return {
    due: memory.due,
    fading: isFadingRetrievability(retrievability),
    recallDays: memory.recallDays,
    retrievability,
    state: memory.state,
    studiedAt: learnerSkill && learnerSkill.reps > 0 ? learnerSkill.createdAt : null,
  };
}
