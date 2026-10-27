import { appPostRoute } from "@/lib/http/app-post-route";
import { answerPronunciationReview } from "@zoonk/core/language/pronunciation/answer";
import { pronunciationAnswerFieldsSchema } from "@zoonk/core/language/pronunciation/contract";
import { type PronunciationAnswerOutcome } from "@zoonk/learn/language/pronunciation";

function readField(form: FormData | null, name: string) {
  const value = form?.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * Grades one recorded review word through the same core capability as
 * `POST /v1/pronunciation-reviews/{reviewId}/answers`: the `audio` recording with `goalId`,
 * `roundId`, `durationMs` and `timeZone` fields, as multipart. A route rather than a Server Action, so the
 * upload and its grade hold up nothing else on the screen and don't re-render it, and a recording
 * up to the grader's own size limit fits (a Server Action takes 1 MB).
 */
export const POST = appPostRoute<{ reviewId: string }>(
  "pronunciationAnswerRoute",
  async (request, { reviewId }): Promise<PronunciationAnswerOutcome> => {
    const form = await request.formData().catch(() => null);
    const audio = form?.get("audio");

    const fields = pronunciationAnswerFieldsSchema.safeParse({
      durationMs: readField(form, "durationMs"),
      goalId: readField(form, "goalId"),
      roundId: readField(form, "roundId"),
      timeZone: readField(form, "timeZone"),
    });

    if (!(audio instanceof Blob) || !fields.success) {
      return { status: "failed" };
    }

    const result = await answerPronunciationReview({
      audio: { bytes: new Uint8Array(await audio.arrayBuffer()), mediaType: audio.type },
      fields: fields.data,
      reviewId,
    });

    if (
      result.status === "graded" ||
      result.status === "noSpeech" ||
      result.status === "signUpRequired"
    ) {
      return result;
    }

    return { status: "failed" };
  },
);
