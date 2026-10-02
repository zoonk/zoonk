import { type StudySessionBlock } from "@zoonk/db";
import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";

/** About two thousand words: longer than any exam essay, short enough to grade in one call. */
const MAX_ESSAY_CHARACTERS = 12_000;

/** An hour and a half covers the longest exam essay; anything more is a tab left open. */
const MAX_WRITING_MS = 5_400_000;

export const essaySubmissionInputSchema = z
  .object({
    durationMs: z.int().min(0).max(MAX_WRITING_MS).meta({ description: "Time spent writing" }),
    text: z.string().trim().min(1).max(MAX_ESSAY_CHARACTERS),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "EssaySubmissionInput" });

export type EssaySubmissionInput = z.infer<typeof essaySubmissionInputSchema>;

/** One graded draft: the text as written and its grade by the official rubric. */
export type EssayDraft = { grade: EssayGradeView; submittedAt: string; text: string };

/**
 * The writing screen for a produce block: the prompt, the rubric it's graded with, and the
 * drafts so far with their grades (latest first), so the learner can rewrite only what needs it.
 */
export type EssayView = {
  blockId: string;
  context: string | null;
  drafts: EssayDraft[];
  /** Grades left today; essays are graded by a model, so a day has a fair limit. */
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
    nextStep: z.object({ criterionId: z.string(), text: z.string() }),
    range: z
      .object({ high: z.number(), low: z.number() })
      .meta({ description: "The estimated range, labeled Estimated" }),
    total: scoreSchema,
    zeroReason: z.enum(["offTopic", "notArgumentative", "tooShort"]).nullable(),
  })
  .meta({ id: "EssayGrade" });

/** A grade by the official rubric, as the writing screen shows it. */
export type EssayGradeView = z.infer<typeof essayGradeSchema>;

/** A stored draft on its attempt: the text and the grade it got. */
export const essayAnswerSchema = z.object({ grade: essayGradeSchema, text: z.string() });
