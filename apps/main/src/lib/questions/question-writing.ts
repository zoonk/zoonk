import { readRefusedLimit } from "@/lib/api/refused-limit";
import { getWorkflowAuthHeaders } from "@/lib/workflow/auth-headers";
import { type HelpLimit } from "@zoonk/learn/help-limit";
import { safeAsync } from "@zoonk/utils/error";
import { getString } from "@zoonk/utils/json";
import { API_URL } from "@zoonk/utils/url";

export type QuestionWriting =
  | { generationId: string; status: "writing" }
  | { limit: HelpLimit; status: "refused" }
  | { status: "failed" | "preparing" | "ready" };

/**
 * Asks the API to write the questions a test still needs (a chapter's test-out, a plan's focus
 * test, a mock), when the learner taps for it (a POST, never on page load): `ready` when it has
 * them, `preparing` while the goal's skill map is still drawn (ask again soon), or the run writing
 * them. `path` is the test's generations endpoint under `/v1`; `body`, what the endpoint asks for.
 */
export async function requestQuestionWriting(
  path: string,
  body?: Record<string, unknown>,
): Promise<QuestionWriting> {
  const auth = await getWorkflowAuthHeaders();
  const url = `${API_URL}/v1${path}`;
  const headers = body ? { ...auth, "Content-Type": "application/json" } : auth;

  const { data: response, error } = await safeAsync(() =>
    fetch(url, { body: body && JSON.stringify(body), headers, method: "POST" }),
  );

  if (error) {
    return { status: "failed" };
  }

  const answer: unknown = await response.json().catch(() => null);
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
