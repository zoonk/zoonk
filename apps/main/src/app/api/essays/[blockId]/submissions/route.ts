import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import {
  type EssayDraft,
  type WrittenEssayDraft,
  essaySubmissionInputSchema,
} from "@zoonk/core/exams/essays/contract";
import { getEssay } from "@zoonk/core/exams/essays/get";
import { submitEssay } from "@zoonk/core/exams/essays/submit";

/** A route, not a Server Action: grading takes seconds, and an action would hold up the screen's other requests. */
export const POST = appPostRoute<{ blockId: string }>(
  "essaySubmissionRoute",
  async (
    request,
    { blockId },
  ): Promise<
    EssayDraft | WrittenEssayDraft | "blockNotActive" | "limitReached" | "signUpRequired" | null
  > => {
    const body = essaySubmissionInputSchema.safeParse(await readJsonBody(request));

    if (!body.success) {
      return null;
    }

    const result = await submitEssay({ blockId, input: body.data });

    if (
      result.status === "blockNotActive" ||
      result.status === "limitReached" ||
      result.status === "signUpRequired"
    ) {
      return result.status;
    }

    if (result.status === "graded") {
      return { grade: result.grade, submittedAt: new Date().toISOString(), text: body.data.text };
    }

    if (result.status !== "writingGraded") {
      return null;
    }

    // The saved answer carries the id a rewrite starts from.
    const read = await getEssay({ blockId });
    const saved = read.status === "ready" ? read.essay.writtenDrafts?.[0] : undefined;
    return saved ?? null;
  },
);
