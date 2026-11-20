import { type EssayDraft, type EssayView } from "@zoonk/core/exams/essays/contract";
import { type WritingDraft } from "@zoonk/core/exams/essays/writing-contract";

export type WritingStartAnswer =
  | { admissionId: string; status: "ready" }
  | { generationId: string; status: "writing" }
  | { returnsOn: string; status: "limitReached" }
  | { status: "failed" | "signUpRequired" };

export type WritingDraftAnswer =
  | { draft: Pick<WritingDraft, "revision" | "text">; status: "conflict" | "saved" }
  | { status: "closed" | "failed" };

/** Null when it couldn't be graded; sending the same admission again replays its grade. */
type WritingSubmitAnswer = EssayDraft | null;

export type WritingActions = {
  /** False when it didn't go through. */
  finish: () => Promise<boolean>;
  saveDraft: (draft: WritingDraft) => Promise<WritingDraftAnswer>;
  /** A rewrite names the graded answer it starts from; anything else replays the block's start. */
  start: (input: { previousAttemptId?: string }) => Promise<WritingStartAnswer>;
  submit: (input: {
    admissionId: string;
    durationMs: number;
    text: string;
  }) => Promise<WritingSubmitAnswer>;
};

export type WrittenEssay = EssayView;
