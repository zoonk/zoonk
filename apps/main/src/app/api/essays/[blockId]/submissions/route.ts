import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { type EssayDraft, essaySubmissionInputSchema } from "@zoonk/core/exams/essays/contract";
import { submitEssay } from "@zoonk/core/exams/essays/submit";

/**
 * Grades a draft of the block's essay through the same core capability as
 * `POST /v1/essays/{blockId}/submissions`: the graded draft, "limitReached" when today's grades
 * ran out, or null when it couldn't be graded. Grading takes seconds, so it's a route rather than
 * a Server Action, which would hold up the screen's other requests until it's done.
 */
export const POST = appPostRoute<{ blockId: string }>(
  "essaySubmissionRoute",
  async (request, { blockId }): Promise<EssayDraft | "limitReached" | null> => {
    const body = essaySubmissionInputSchema.safeParse(await readJsonBody(request));

    if (!body.success) {
      return null;
    }

    const result = await submitEssay({ blockId, input: body.data });

    if (result.status === "limitReached") {
      return "limitReached";
    }

    return result.status === "graded"
      ? { grade: result.grade, submittedAt: new Date().toISOString(), text: body.data.text }
      : null;
  },
);
