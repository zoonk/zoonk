import { type StudySessionBlock } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";
import {
  MAX_ESSAY_CHARACTERS,
  type WritingDraft,
  type WritingPacing,
  type WritingPrompt,
  type WritingResult,
  writingPromptSchema,
  writingResultSchema,
} from "./writing-contract";

export const writingAttemptSchema = z
  .object({ grade: writingResultSchema, text: z.string() })
  .extend({ attemptId: uuidSchema(), submittedAt: z.iso.datetime(), writing: writingPromptSchema })
  .meta({ id: "WritingAttempt" });

export { MAX_ESSAY_CHARACTERS } from "./writing-contract";

// Saved drafts can accumulate active writing time across several days.
export const MAX_WRITING_MS = 24 * 60 * 60 * 1000;

export const essaySubmissionInputSchema = z
  .object({
    admissionId: uuidSchema().describe("The admission issued when this writing attempt started"),
    durationMs: z.int().min(0).max(MAX_WRITING_MS).meta({ description: "Time spent writing" }),
    text: z.string().max(MAX_ESSAY_CHARACTERS),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "EssaySubmissionInput" });

export type EssaySubmissionInput = z.infer<typeof essaySubmissionInputSchema>;

export type EssayDraft = {
  attemptId: string;
  grade: WritingResult;
  submittedAt: string;
  text: string;
};

export type EssayView = {
  blockId: string;
  draft: WritingDraft | null;
  context: string | null;
  drafts: EssayDraft[];
  gradesLeft: number;
  pacing: WritingPacing;
  question: string;
  rubric: "enem" | "oab" | "points" | "levels";
  sessionId: string;
  status: StudySessionBlock["status"];
  writing: WritingPrompt;
};
