"use server";

import { type EssayDraft, essaySubmissionInputSchema } from "@zoonk/core/exams/essays/contract";
import { submitEssay } from "@zoonk/core/exams/essays/submit";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const blockIdSchema = z.uuid();

/**
 * Grades a draft of the block's essay. Returns the graded draft, "limitReached" when today's
 * grades ran out, or null when it couldn't be graded. Inputs are untrusted and parsed first.
 */
export async function submitEssayAction(
  blockId: unknown,
  input: unknown,
): Promise<EssayDraft | "limitReached" | null> {
  const id = blockIdSchema.safeParse(blockId);
  const body = essaySubmissionInputSchema.safeParse(input);

  if (!id.success || !body.success) {
    return null;
  }

  // A grade that fails (the model or the network) must come back as "couldn't grade", so the
  // screen offers another try instead of waiting on "Grading…" forever.
  const { data: result, error } = await safeAsync(() =>
    submitEssay({ blockId: id.data, input: body.data }),
  );

  if (error) {
    logError("[submitEssayAction] Failed to grade an essay:", error);
    return null;
  }

  if (result.status === "limitReached") {
    return "limitReached";
  }

  return result.status === "graded"
    ? { grade: result.grade, submittedAt: new Date().toISOString(), text: body.data.text }
    : null;
}
