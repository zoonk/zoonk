import { readRefusedLimit } from "@/lib/api/refused-limit";
import { getWorkflowAuthHeaders } from "@/lib/workflow/auth-headers";
import { type HelpLimit } from "@zoonk/learn/help-limit";
import { safeAsync } from "@zoonk/utils/error";
import { getString } from "@zoonk/utils/json";
import { API_URL } from "@zoonk/utils/url";

export type TestOutWriting =
  | { generationId: string; status: "writing" }
  | { limit: HelpLimit; status: "refused" }
  | { status: "failed" | "ready" };

/**
 * Asks the API to write the questions a chapter's test-out still needs, when the learner taps
 * for its test (a POST, never on page load): `ready` when it has them, or the run writing them.
 */
export async function requestTestOutWriting({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId: string;
}): Promise<TestOutWriting> {
  const headers = await getWorkflowAuthHeaders();
  const url = `${API_URL}/v1/goals/${encodeURIComponent(goalId)}/chapters/${encodeURIComponent(chapterId)}/test-out/generations`;
  const { data: response, error } = await safeAsync(() => fetch(url, { headers, method: "POST" }));

  if (error) {
    return { status: "failed" };
  }

  const body: unknown = await response.json().catch(() => null);
  const limit = readRefusedLimit({ body, status: response.status });

  if (limit) {
    return { limit, status: "refused" };
  }

  if (!response.ok) {
    return { status: "failed" };
  }

  const generationId = getString(body, "generationId");
  return generationId ? { generationId, status: "writing" } : { status: "ready" };
}
