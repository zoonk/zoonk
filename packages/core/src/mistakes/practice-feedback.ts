import { MistakeStatus } from "@zoonk/db/enums";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { lessonStepCheckResultSchema } from "../lesson-player/contract";
import { studyAnswerInputSchema } from "../sessions/contract";
import { reachedSchema } from "../sessions/reached";

const mistakeStatusSchema = z.enum(MistakeStatus);
export const mistakePracticeFeedbackSchema = z
  .object({
    answerId: uuidSchema()
      .nullable()
      .meta({ description: "The answer's id: send the run's answer ids when it finishes" }),
    correctAnswer: studyAnswerInputSchema.shape.answer.nullable(),
    explanation: z.string().nullable(),
    fixed: z.boolean().meta({ description: "This answer fixed the practiced notebook entry" }),
    fixedMistakeIds: z
      .array(uuidSchema())
      .meta({
        description:
          "Every notebook entry fixed by this answer; deduplicate these for the run correction count",
      }),
    isCorrect: z.boolean(),
    lessonResult: lessonStepCheckResultSchema.nullable(),
    mistakeStatus: mistakeStatusSchema.meta({
      description: "Fixed once answered right on a later day",
    }),
    reached: reachedSchema.meta({
      description:
        "What counting the run with this answer reached (a belt level, a tenth of Energy), when the answer came with its run: the run counts as it goes, so its end celebrates what each answer's count reached together with the completion's own",
    }),
    trap: z
      .string()
      .nullable()
      .meta({
        description:
          "In a trap drill, the misconception matching the wrong answer; null for correct, unknown, or unmatched answers",
      }),
    workedSteps: z.array(z.string()),
  })
  .meta({ id: "MistakePracticeFeedback" });

export type MistakePracticeFeedback = z.infer<typeof mistakePracticeFeedbackSchema>;
