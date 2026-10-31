import { type MilestoneView, milestoneSchema } from "./completion-contract";
import { type Reached, reachedSchema } from "./reached";

/** Off-session results share one ceremony and newly reached belt/Energy levels. */
export type ProgressCelebration = { ceremony: MilestoneView | null; reached: Reached };

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
