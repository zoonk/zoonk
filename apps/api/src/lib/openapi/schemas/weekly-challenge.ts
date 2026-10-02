import { EXAM_DAY_CHECKLIST } from "@zoonk/core/checkpoints/weekly-challenge-rules";
import { z } from "zod";
import { logicalDateSchema } from "./study-sessions";

const idSchema = z.uuid();

const mockConditionsSchema = z
  .object({
    netScoring: z.boolean(),
    questions: z.number().int().min(0),
    sections: z.array(
      z.object({
        minutes: z.number().int().nullable(),
        name: z.string().nullable().meta({ description: "Null when the exam doesn't name it" }),
        questions: z.number().int().nullable(),
      }),
    ),
    timeLimitMinutes: z.number().int().min(0),
  })
  .meta({ id: "MockConditions" });

export const weeklyChallengeResponseSchema = z
  .object({
    challenge: z
      .object({
        access: z.enum(["open", "plusRequired"]),
        brainPower: z.number().int(),
        checklist: z.array(z.enum(EXAM_DAY_CHECKLIST)),
        conditions: mockConditionsSchema.nullable(),
        date: logicalDateSchema.nullable(),
        kind: z.enum(["mixed", "mock"]),
        planItemId: idSchema,
        questions: z.number().int().min(0),
        startTime: z
          .string()
          .nullable()
          .meta({
            description:
              "When it starts, \"HH:MM\": the real exam's start time for a mock when the notice gives it, otherwise the learner's study time",
          }),
        timeZone: z
          .string()
          .nullable()
          .meta({ description: "The IANA zone of an exam's start time; null for study time" }),
        title: z.string(),
      })
      .nullable(),
  })
  .meta({ id: "WeeklyChallenge" });
