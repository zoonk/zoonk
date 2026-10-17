import { postFromBrowser, readJsonForThisLearner } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { type HelpLimit } from "@zoonk/learn/help-limit";
import { getString, isJsonObject } from "@zoonk/utils/json";

export type QuestionWriting =
  | { generationId: string; status: "writing" }
  | { limit: HelpLimit; status: "refused" }
  | { status: "failed" | "plusRequired" | "preparing" | "ready" };

/**
 * Asks the API to write the questions a test still needs (a chapter's test-out, a plan's focus
 * test, a mock), when the learner taps for it (a POST, never on page load): `ready` when it has
 * them, `preparing` while the goal's skill map is still drawn (ask again soon), or the run writing
 * them, or `plusRequired` when a free exam plan past its first week takes the test with Plus only.
 * `path` is the test's generations endpoint under `/v1`; `body`, what the endpoint asks for.
 */
export async function requestQuestionWriting(
  path: `/${string}`,
  body?: Record<string, unknown>,
): Promise<QuestionWriting> {
  const response = await postFromBrowser({ body, path: `/v1${path}` });

  if (!response) {
    return { status: "failed" };
  }

  const answer = await readJsonForThisLearner(response);

  // The route always answers JSON: no body (or one read once the page belonged to someone else)
  // is no answer.
  if (answer === null) {
    return { status: "failed" };
  }

  if (
    getString(isJsonObject(answer) ? answer.error : null, "code") ===
    LESSON_PLAYER_ERROR_CODES.plusRequired
  ) {
    return { status: "plusRequired" };
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
