import { SuggestedGoalStatus } from "@zoonk/db";
import { z } from "zod";

/**
 * A course the learner was taking before goals existed, offered on Today as a goal to plan
 * ("Continue Physics? Build a plan in 1 minute"). Accepting opens that course's start, or onboarding
 * with its `title` as the goal once nobody can start the course anymore.
 */
export type SuggestedGoalView = {
  /** The course to start on accepting, while anyone can still start it; null opens onboarding. */
  courseId: string | null;
  id: string;
  status: SuggestedGoalStatus;
  title: string;
};

export const suggestedGoalAnswerSchema = z
  .object({
    status: z
      .enum([SuggestedGoalStatus.accepted, SuggestedGoalStatus.dismissed])
      .meta({
        description:
          "accepted when the learner goes on to plan the goal (open onboarding with its title); dismissed closes it",
      }),
  })
  .strict()
  .meta({ id: "SuggestedGoalAnswer" });

export type SuggestedGoalAnswerInput = z.infer<typeof suggestedGoalAnswerSchema>;
