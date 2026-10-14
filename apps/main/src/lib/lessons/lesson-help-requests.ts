"use client";

import { getFromBrowser, postFromBrowser } from "@/lib/api/browser-api";
import { type ExampleLine } from "@zoonk/player/lesson/types";
import { getString, isJsonObject } from "@zoonk/utils/json";

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/** The API's example line: the saved line and whether asking can write one. */
async function readExampleLine(response: Response | null): Promise<ExampleLine | null> {
  if (!response?.ok) {
    return null;
  }

  const body = await readBody(response);

  return isJsonObject(body)
    ? { canRequest: body.canRequest === true, line: getString(body, "line") }
    : null;
}

/** Reads an already-written personal example without starting AI work. */
export async function getExampleLine({ stepId }: { stepId: string }): Promise<ExampleLine | null> {
  return readExampleLine(
    await getFromBrowser(`/v1/me/example-lines/${encodeURIComponent(stepId)}`),
  );
}

/** Generates a personal example only after the learner asks for it. */
export async function requestExampleLine({
  stepId,
}: {
  stepId: string;
}): Promise<ExampleLine | null> {
  return readExampleLine(
    await postFromBrowser({ path: `/v1/me/example-lines/${encodeURIComponent(stepId)}` }),
  );
}
