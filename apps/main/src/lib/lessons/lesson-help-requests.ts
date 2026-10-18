"use client";

import { getFromBrowser, postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import { type AnswerExplanationOutcome, type ExampleLine } from "@zoonk/player/lesson/types";
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

/**
 * "Explain answer" on a wrong typed answer, asked from the browser so it never holds up the
 * lesson's answers while the explanation is written. A refusal says which allowance ran out;
 * anything else that isn't an explanation is a failure the learner can try again.
 */
export async function requestAnswerExplanation({
  answer,
  stepId,
}: {
  answer: string;
  stepId: string;
}): Promise<AnswerExplanationOutcome> {
  const response = await postFromBrowser({
    body: { answer },
    path: `/v1/steps/${encodeURIComponent(stepId)}/answer-explanations`,
  });

  if (!response) {
    return { status: "failed" };
  }

  const body = await readBody(response);
  const explanation = response.ok ? getString(body, "explanation") : null;

  if (explanation) {
    return { explanation, status: "explained" };
  }

  return readRefusedLimit({ body, status: response.status }) ?? { status: "failed" };
}
