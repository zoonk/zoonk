import { postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { type HelpLimit } from "@zoonk/learn/help-limit";
import { getString, isJsonObject } from "@zoonk/utils/json";

export type QuestionWriting =
  | { generationId: string; status: "writing" }
  | { limit: HelpLimit; status: "refused" }
  /** Today's extra writing is used: a written test's questions return on that day. */
  | { returnsOn: string; status: "writingUsedUp" }
  | { status: "failed" | "plusRequired" | "preparing" | "ready" };

const HTTP_TOO_MANY_REQUESTS = 429;

function readReturnsOn({ body, status }: { body: unknown; status: number }): string | null {
  const error = isJsonObject(body) ? body.error : null;

  if (
    status !== HTTP_TOO_MANY_REQUESTS ||
    getString(error, "code") !== LESSON_PLAYER_ERROR_CODES.usageLimitReached
  ) {
    return null;
  }

  return getString(isJsonObject(error) ? error.details : null, "returnsOn");
}

export async function requestQuestionWriting(
  path: `/${string}`,
  body?: Record<string, unknown>,
): Promise<QuestionWriting> {
  const response = await postFromBrowser({ body, path: `/v1${path}` });

  if (!response) {
    return { status: "failed" };
  }

  const answer: unknown = await response.json().catch(() => null);

  if (answer === null) {
    return { status: "failed" };
  }

  if (
    getString(isJsonObject(answer) ? answer.error : null, "code") ===
    LESSON_PLAYER_ERROR_CODES.plusRequired
  ) {
    return { status: "plusRequired" };
  }

  const returnsOn = readReturnsOn({ body: answer, status: response.status });

  if (returnsOn) {
    return { returnsOn, status: "writingUsedUp" };
  }

  const limit = readRefusedLimit({ body: answer, status: response.status });

  if (limit) {
    return { limit, status: "refused" };
  }

  if (!response.ok) {
    return { status: "failed" };
  }

  const generationId = getString(answer, "generationId");

  if (generationId) {
    return { generationId, status: "writing" };
  }

  return getString(answer, "status") === "preparing"
    ? { status: "preparing" }
    : { status: "ready" };
}
