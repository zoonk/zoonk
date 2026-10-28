import { type StudySessionBlock } from "@zoonk/db";
import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";

export const MAX_ESSAY_CHARACTERS = 12_000;

const MAX_WRITING_MS = 5_400_000;

export const essaySubmissionInputSchema = z
  .object({
    attemptId: z
      .uuid()
      .optional()
      .describe(
        "Your id for this draft: sent again with it (a retry), it's graded and recorded once",
      ),
    durationMs: z.int().min(0).max(MAX_WRITING_MS).meta({ description: "Time spent writing" }),
    text: z.string().trim().min(1).max(MAX_ESSAY_CHARACTERS),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "EssaySubmissionInput" });

export type EssaySubmissionInput = z.infer<typeof essaySubmissionInputSchema>;

export type EssayDraft = { grade: EssayGradeView; submittedAt: string; text: string };

export type EssayView = {
  blockId: string;
  context: string | null;
  drafts: EssayDraft[];
  gradesLeft: number;
  question: string;
  rubric: "ap" | "custom" | "enem" | "oab";
  sessionId: string;
  status: StudySessionBlock["status"];
};

const scoreSchema = z.object({ maxScore: z.number(), score: z.number() });

export const essayGradeSchema = z
  .object({
    criteria: z.array(
      scoreSchema.extend({
        comment: z.string(),
        example: z.string().nullable(),
        id: z
          .string()
          .meta({
            description: "c1..c5 for ENEM, fixed section ids for OAB, criterion-n otherwise",
          }),
        name: z.string(),
        quote: z.string().nullable().meta({ description: "An exact passage of the essay" }),
      }),
    ),
    enemInterventionElements: z
      .object({
        action: z.boolean(),
        agent: z.boolean(),
        detail: z.boolean(),
        effect: z.boolean(),
        means: z.boolean(),
      })
      .nullable()
      .meta({ description: "ENEM's five intervention proposal elements; null for other rubrics" }),
    nextStep: z
      .object({ criterionId: z.string(), text: z.string() })
      .nullable()
      .meta({
        description:
          "The one thing to work on, on the criterion with the most points to gain; null when every criterion has full marks",
      }),
    range: z
      .object({ high: z.number(), low: z.number() })
      .meta({ description: "The estimated range, labeled Estimated" }),
    total: scoreSchema,
    zeroReason: z.enum(["offTopic", "notArgumentative", "tooShort"]).nullable(),
  })
  .meta({ id: "EssayGrade" });

export type EssayGradeView = z.infer<typeof essayGradeSchema>;

export const essayAnswerSchema = z.object({ grade: essayGradeSchema, text: z.string() });
