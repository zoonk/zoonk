import { type LearnerSkill, type MasteryState } from "@zoonk/db";

/**
 * FSRS stability is the number of days until the chance of recalling a skill drops to 90%. A skill
 * is Solid once that reaches a week: the learner would very likely still do it seven days from now.
 */
const SOLID_STABILITY_DAYS = 7;

/**
 * Mastered means remembered on three different days (successive relearning), never a streak inside
 * one session. It is the gold study card, earned the same way by everyone.
 */
const MASTERED_RECALL_DAYS = 3;

/**
 * The retention FSRS schedules for. A studied skill whose chance of recall drops below it is due,
 * and its study card dims ("fading") until a review relights it.
 */
export const TARGET_RETENTION = 0.9;

type MasteryInput = Pick<LearnerSkill, "recallDays" | "reps" | "stability">;

/**
 * Maps the memory model to the four states both modes show: New (never answered), Learning,
 * Solid (stability of at least a week) and Mastered (remembered on three different days).
 */
export function getMasteryState({ recallDays, reps, stability }: MasteryInput): MasteryState {
  if (reps === 0) {
    return "new";
  }

  if (recallDays >= MASTERED_RECALL_DAYS) {
    return "mastered";
  }

  if (stability >= SOLID_STABILITY_DAYS) {
    return "solid";
  }

  return "learning";
}

/** A studied skill fades once its chance of recall drops below the retention FSRS aims for. */
export function isFadingRetrievability(retrievability: number | null): boolean {
  return retrievability !== null && retrievability < TARGET_RETENTION;
}

export type SkillStateCounts = Record<MasteryState, number> & { fading: number; total: number };

/** How many skills are in each state, and how many are fading: what Cards and chapters show. */
export function countSkillStates(
  skills: readonly { fading: boolean; state: MasteryState }[],
): SkillStateCounts {
  const countState = (state: MasteryState) =>
    skills.filter((skill) => skill.state === state).length;

  return {
    fading: skills.filter((skill) => skill.fading).length,
    learning: countState("learning"),
    mastered: countState("mastered"),
    new: countState("new"),
    solid: countState("solid"),
    total: skills.length,
  };
}
