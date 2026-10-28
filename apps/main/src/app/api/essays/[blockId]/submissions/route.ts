import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { type EssayDraft, essaySubmissionInputSchema } from "@zoonk/core/exams/essays/contract";
import { submitEssay } from "@zoonk/core/exams/essays/submit";

/** A route, not a Server Action: grading takes seconds, and an action would hold up the screen's other requests. */
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
