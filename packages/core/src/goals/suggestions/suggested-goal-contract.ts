import { SuggestedGoalStatus } from "@zoonk/db";
import { z } from "zod";

export type SuggestedGoalView = {
  /** Null once nobody can start the course: accepting opens onboarding with its `title`. */
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
