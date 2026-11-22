"use client";

import { getFromBrowser } from "@/lib/api/browser-api";
import { type MockWriting } from "@zoonk/learn/mock/chooser";
import { getString } from "@zoonk/utils/json";

/**
 * Reads the API, not a Server Action: Next.js sends actions one at a time to whichever page shows by
 * then. An answer it can't read counts as a run still starting, so the wait asks again.
 */
export async function readMockWriting({
  goalId,
  planItemId,
}: {
  goalId: string;
  planItemId?: string;
}): Promise<MockWriting> {
  const query = planItemId ? `?planItemId=${encodeURIComponent(planItemId)}` : "";

  const response = await getFromBrowser(
    `/v1/goals/${encodeURIComponent(goalId)}/mock-writing${query}`,
  );

  const body: unknown = response?.ok ? await response.json().catch(() => null) : null;
  const status = getString(body, "status");

  return {
    generationId: getString(body, "generationId"),
    namespace: getString(body, "namespace"),
    status: status === "none" || status === "writing" ? status : "starting",
  };
}
