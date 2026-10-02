"use client";

import { type MaterialQuestionAnswer } from "@zoonk/core/library/sources/material-question-contract";
import { type MaterialQuestionOutcome } from "@zoonk/learn/onboarding/actions";
import { isJsonObject } from "@zoonk/utils/json";
import { postFromBrowser } from "../api/browser-api";

const HTTP_UNAUTHORIZED = 401;
const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;

function isAnswer(body: unknown): body is MaterialQuestionAnswer {
  return isJsonObject(body) && typeof body.answer === "string" && Array.isArray(body.citations);
}

/** What the API answered, as the questions screen says it. */
async function toOutcome(response: Response): Promise<MaterialQuestionOutcome> {
  const body: unknown = await response.json().catch(() => null);

  if (response.ok && isAnswer(body)) {
    return { answer: body, status: "answered" };
  }

  switch (response.status) {
    case HTTP_UNAUTHORIZED:
    case HTTP_FORBIDDEN:
      return { status: "signInRequired" };
    case HTTP_PAYMENT_REQUIRED:
    case HTTP_TOO_MANY_REQUESTS:
      return { status: "limitReached" };
    default:
      return { status: "failed" };
  }
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
