import { type MasteryState } from "../../../../generated/prisma/client";
import { daysFrom } from "../_utils/dates";

type MemoryShape = {
  state: MasteryState;
  /** FSRS stability in days: how long until recall drops to 90%. */
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  recallDays: number;
  lastReviewedDaysAgo: number;
};

/**
 * The memory states cards and skill lists show. "fading" is a skill studied long enough ago that
 * its chance of recall dropped below 90%, which is when its card dims and a capsule brings it back.
 */
const MEMORY_PRESETS = {
  fading: {
    difficulty: 6.5,
    lapses: 1,
    lastReviewedDaysAgo: 9,
    recallDays: 1,
    reps: 3,
    stability: 3,
    state: "learning",
  },
  learning: {
    difficulty: 5.5,
    lapses: 0,
    lastReviewedDaysAgo: 1,
    recallDays: 1,
    reps: 2,
    stability: 2.5,
    state: "learning",
  },
  mastered: {
    difficulty: 3.5,
    lapses: 0,
    lastReviewedDaysAgo: 6,
    recallDays: 3,
    reps: 6,
    stability: 35,
    state: "mastered",
  },
  solid: {
    difficulty: 4.5,
    lapses: 0,
    lastReviewedDaysAgo: 3,
    recallDays: 2,
    reps: 4,
    stability: 12,
    state: "solid",
  },
} as const satisfies Record<string, MemoryShape>;

export type MemoryPreset = keyof typeof MEMORY_PRESETS;

/** Days between first studying a skill and its last review, so "studied since" reads naturally. */
const STUDY_SPAN_DAYS = 7;

/** A `LearnerSkill` row in one memory state, with its dates relative to `now`. */
export function toLearnerSkillMemory(preset: MemoryPreset, now: Date) {
  const memory = MEMORY_PRESETS[preset];
  const lastReviewedAt = daysFrom(now, -memory.lastReviewedDaysAgo);

  return {
    createdAt: daysFrom(lastReviewedAt, -STUDY_SPAN_DAYS),
    difficulty: memory.difficulty,
    due: daysFrom(lastReviewedAt, memory.stability),
    lapses: memory.lapses,
    lastReviewedAt,
    recallDays: memory.recallDays,
    reps: memory.reps,
    stability: memory.stability,
    state: memory.state,
  };
}
