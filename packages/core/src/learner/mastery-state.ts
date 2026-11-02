import { type LearnerSkill, type MasteryState } from "@zoonk/db";

/** FSRS stability is days until retrievability reaches 90%. */
const SOLID_STABILITY_DAYS = 7;

/** Recall days must be different days, never a same-session streak. */
const MASTERED_RECALL_DAYS = 3;

export const TARGET_RETENTION = 0.9;

type MasteryInput = Pick<LearnerSkill, "recallDays" | "reps" | "stability">;

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

export function isFadingRetrievability(retrievability: number | null): boolean {
  return retrievability !== null && retrievability < TARGET_RETENTION;
}

export type SkillStateCounts = Record<MasteryState, number> & { fading: number; total: number };

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
