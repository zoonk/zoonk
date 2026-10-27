import { type MilestoneView, milestoneSchema } from "./completion-contract";
import { type Reached, reachedSchema } from "./reached";

/**
 * What a learner's work is celebrated with on its own result, the same everywhere they earn Brain
 * Power or Energy (a notebook practice, a drill, a round, a call, a test, a lesson on its own): the
 * belt level and the tenth of Energy it reached, and the one milestone not shown yet, as its
 * full-screen moment before the result.
 */
export type ProgressCelebration = { ceremony: MilestoneView | null; reached: Reached };

/** `ProgressCelebration`'s fields, for a result's schema to extend. */
export const progressCelebrationShape = {
  ceremony: milestoneSchema
    .nullable()
    .meta({
      description:
        "The one milestone the learner hasn't been shown yet (a belt this work crossed, new glasses): show it as a full-screen moment before the result, then mark it shown; null when there's none",
    }),
  reached: reachedSchema.meta({
    description:
      "The belt level and the tenth of Energy this work took the learner to, to celebrate on its result; nothing on a repeat, which celebrates none of it again",
  }),
};
