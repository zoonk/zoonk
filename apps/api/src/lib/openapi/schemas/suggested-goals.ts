import { SuggestedGoalStatus } from "@zoonk/db";
import { z } from "zod";

export const suggestedGoalSchema = z
  .object({
    courseId: z
      .uuid()
      .nullable()
      .meta({
        description:
          "The course to start on accepting (POST /v1/courses/{courseId}/goals), while anyone can still start it; null once it's gone, when apps open onboarding with the title",
      }),
    id: z.uuid(),
    status: z.enum(SuggestedGoalStatus),
    title: z
      .string()
      .meta({
        description: "The course's title, which onboarding opens with when courseId is null",
      }),
  })
  .meta({
    description:
      'A course the learner was taking before goals existed, offered as a goal to plan: "Continue Physics? Build a plan in 1 minute"',
    id: "SuggestedGoal",
  });

export const suggestedGoalResultSchema = z
  .object({ suggestedGoal: suggestedGoalSchema })
  .meta({ id: "SuggestedGoalResult" });
