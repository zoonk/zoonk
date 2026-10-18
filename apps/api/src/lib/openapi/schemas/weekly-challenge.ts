import { EXAM_DAY_CHECKLIST } from "@zoonk/core/checkpoints/weekly-challenge-rules";
import { z } from "zod";
import { mockLeftOutSchema } from "./mock-left-out";
import { logicalDateSchema } from "./study-sessions";

const idSchema = z.uuid();

const mockWrittenTaskSchema = z.object({
  count: z
    .number()
    .int()
    .nullable()
    .meta({ description: "Null when the description says how many" }),
  description: z.string(),
});

const mockWrittenPartSchema = z
  .object({
    asked: z
      .boolean()
      .meta({
        description:
          "The mock asks it with the exam's own essay, written on the mock's clock and graded after hand-in; false: practiced in essay sessions, since the bank has no essay for it yet",
      }),
    minutes: z.number().int().nullable(),
    name: z.string(),
    tasks: z.array(mockWrittenTaskSchema),
  })
  .meta({ id: "MockWrittenPart" });

/** A full-length mock's written parts, shared by the week's challenge and the challenge screen. */
export const mockWrittenPartsSchema = z
  .array(mockWrittenPartSchema)
  .meta({
    description:
      "A full-length mock's parts answered in writing (a discursive test, a legal brief), as the notice states them; never objective questions, and never in `sections`",
  });

const mockConditionsSchema = z
  .object({
    fullLength: z
      .boolean()
      .meta({
        description:
          "The whole exam day, as in the final stretch; false for a short mock (half of it), which regular weeks hold",
      }),
    leftOut: mockLeftOutSchema,
    netScoring: z.boolean(),
    questions: z.number().int().min(0),
    sections: z.array(
      z.object({
        minutes: z.number().int().nullable(),
        name: z.string().nullable().meta({ description: "Null when the exam doesn't name it" }),
        questions: z.number().int().nullable(),
        tools: z
          .string()
          .nullable()
          .meta({ description: "What may be used or is given in it, in the notice's words" }),
      }),
    ),
    timeLimitMinutes: z.number().int().min(0),
    written: mockWrittenPartsSchema,
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
        questions: z
          .number()
          .int()
          .min(0)
          .nullable()
          .meta({ description: "Null while the challenge's size is unknown" }),
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
        title: z.string().nullable().meta({ description: "Null while the challenge has no title" }),
      })
      .nullable(),
  })
  .meta({ id: "WeeklyChallenge" });
