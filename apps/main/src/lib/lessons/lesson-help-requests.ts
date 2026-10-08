"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
import { getString } from "@zoonk/utils/json";

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/**
 * The web player's example line: one sentence tying an explanation to the learner's life, asked
 * for when the screen opens. It's a bonus that arrives after the screen shows, so anything but a
 * line just leaves it out. It goes to the API from the browser, so writing it never holds up the
 * lesson's Server Actions, such as checking an answer.
 */
export async function requestExampleLine({ stepId }: { stepId: string }): Promise<string | null> {
  const response = await postFromBrowser({
    path: `/v1/me/example-lines/${encodeURIComponent(stepId)}`,
  });

  return response?.ok ? getString(await readBody(response), "line") : null;
}
