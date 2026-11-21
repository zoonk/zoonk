"use client";

import { type WritingStartAnswer } from "@zoonk/learn/writing";

/**
 * How the learner's own tap answered, carried to the question's page in this tab only. The address
 * carries none of it, so a reload, a shared link or a restored tab shows what the server says and
 * starts nothing by itself.
 */
const answers = new Map<string, Exclude<WritingStartAnswer, { status: "ready" }>>();

export function handOverWritingStart({
  answer,
  blockId,
}: {
  answer: WritingStartAnswer;
  blockId: string;
}): `/essay/${string}` {
  if (answer.status !== "ready") {
    answers.set(blockId, answer);
  }

  return `/essay/${encodeURIComponent(blockId)}`;
}

export function readWritingStartHandoff(blockId: string) {
  return answers.get(blockId) ?? null;
}

export function forgetWritingStartHandoff(blockId: string) {
  answers.delete(blockId);
}
