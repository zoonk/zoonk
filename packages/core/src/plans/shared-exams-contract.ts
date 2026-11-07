import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const sharedExamsSchema = z
  .array(
    z.object({
      goalId: uuidSchema(),
      name: z.string().meta({ description: "The exam's name, or the goal's title" }),
    }),
  )
  .meta({
    description:
      "For an exam goal: the learner's other active or paused exam goals whose plans teach some of the same skills with the same lessons, in the order they were started. A lesson on a shared skill counts in each, so a topic is studied once for all of them; practice and mocks stay in each exam's style. Each subject's `sharedWith` names which. Empty for other goals, and when nothing is shared",
  });

export const sharedWithSchema = z
  .array(uuidSchema())
  .meta({
    description:
      "The goals in `sharedExams` whose plans also teach some of this subject's skills with the same lessons: show it as also in those exams. Empty when no other exam shares it",
  });

export type SharedExam = z.infer<typeof sharedExamsSchema>[number];
