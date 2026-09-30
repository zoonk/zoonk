"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
import { type StepVariantKind, type StepVariantOutcome } from "@zoonk/player/lesson/types";
import { getUsageRefusal } from "@zoonk/player/usage-refusal";
import { getString, isJsonObject } from "@zoonk/utils/json";

const HTTP_UNPROCESSABLE_ENTITY = 422;

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/** What `POST /v1/steps/{stepId}/variants` answered, as "Simpler" and "Go deeper" show it. */
async function toVariantOutcome(response: Response): Promise<StepVariantOutcome> {
  const body = await readBody(response);
  const id = getString(body, "id");

  if (response.ok && id && isJsonObject(body)) {
    return { content: body.content, id, status: "ready" };
  }

  if (response.status === HTTP_UNPROCESSABLE_ENTITY) {
    return { status: "unsupported" };
  }

  const refusal = getUsageRefusal(body);

  if (refusal?.kind === "slowDown") {
    return { retryAfterSeconds: refusal.retryAfterSeconds, status: "slowDown" };
  }

  return refusal ? { status: "limitReached", tier: refusal.tier } : { status: "failed" };
}

/**
 * The web player's "Simpler" and "Go deeper": the shared version of a screen, written the first
 * time anyone asks. Writing one takes seconds, so it goes to the API from the browser and never
 * holds up the lesson's Server Actions, such as checking an answer.
 */
export async function requestStepVariant({
  kind,
  stepId,
}: {
  kind: StepVariantKind;
  stepId: string;
}): Promise<StepVariantOutcome> {
  const response = await postFromBrowser({
    body: { kind },
    path: `/v1/steps/${encodeURIComponent(stepId)}/variants`,
  });

  return response ? toVariantOutcome(response) : { status: "failed" };
}

/**
 * The web player's example line: one sentence tying an explanation to the learner's life, asked
 * for when the screen opens. It's a bonus that arrives after the screen shows, so anything but a
 * line just leaves it out, and like "Simpler" it never holds up the lesson's Server Actions.
 */
export async function requestExampleLine({ stepId }: { stepId: string }): Promise<string | null> {
  const response = await postFromBrowser({
    path: `/v1/me/example-lines/${encodeURIComponent(stepId)}`,
  });

  return response?.ok ? getString(await readBody(response), "line") : null;
}
