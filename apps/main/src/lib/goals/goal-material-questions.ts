"use client";

import { type MaterialQuestionAnswer } from "@zoonk/core/library/sources/material-question-contract";
import { type MaterialQuestionOutcome } from "@zoonk/learn/onboarding/actions";
import { getUsageRefusal } from "@zoonk/player/usage-refusal";
import { isJsonObject } from "@zoonk/utils/json";
import { postFromBrowser } from "../api/browser-api";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

function isAnswer(body: unknown): body is MaterialQuestionAnswer {
  return isJsonObject(body) && typeof body.answer === "string" && Array.isArray(body.citations);
}

/** What the API answered, as the questions screen says it. */
async function toOutcome(response: Response): Promise<MaterialQuestionOutcome> {
  const body: unknown = await response.json().catch(() => null);

  if (response.ok && isAnswer(body)) {
    return { answer: body, status: "answered" };
  }

  const refusal = getUsageRefusal(body);

  if (refusal?.kind === "slowDown") {
    return { status: "slowDown" };
  }

  // A guest's tutor answers need an account.
  if (refusal?.kind === "usageLimit" && refusal.tier !== "guest") {
    return { period: refusal.period, status: "limitReached", tier: refusal.tier };
  }

  return response.status === HTTP_UNAUTHORIZED || response.status === HTTP_FORBIDDEN || refusal
    ? { status: "signInRequired" }
    : { status: "failed" };
}

/**
 * "Ask questions" about the material attached with the paperclip, through
 * `POST /v1/material-questions`, like the uploads that stored it.
 */
export async function askMaterialQuestion(input: {
  language: string;
  question: string;
  sourceIds: string[];
}): Promise<MaterialQuestionOutcome> {
  const response = await postFromBrowser({ body: input, path: "/v1/material-questions" });
  return response ? toOutcome(response) : { status: "failed" };
}
