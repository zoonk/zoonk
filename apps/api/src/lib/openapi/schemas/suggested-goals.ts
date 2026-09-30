import { SuggestedGoalStatus } from "@zoonk/db";
import { z } from "zod";

export const suggestedGoalSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(SuggestedGoalStatus),
    title: z.string().meta({ description: "The course's title, which onboarding opens with" }),
  })
  .meta({
    description:
      'A course the learner was taking before goals existed, offered as a goal to plan: "Continue Physics? Build a plan in 1 minute"',
    id: "SuggestedGoal",
  });

export const suggestedGoalResultSchema = z
  .object({ suggestedGoal: suggestedGoalSchema })
  .meta({ id: "SuggestedGoalResult" });
