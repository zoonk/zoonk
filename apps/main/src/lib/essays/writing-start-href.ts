import { type WritingStartAnswer } from "@zoonk/learn/writing";
import { type WritingStartState } from "@zoonk/learn/writing/start";

export const WRITING_START_PARAM = "writing";

const LIMIT = "limit";
const FAILED = "failed";

function toStartValue(status: "failed" | "limitReached" | "signUpRequired"): string {
  return status === "limitReached" ? LIMIT : FAILED;
}

/** Where a start answered: the question, or what stands before it, carried in the address as a lesson's run is. */
export function getWritingHref({
  answer,
  blockId,
}: {
  answer: WritingStartAnswer;
  blockId: string;
}): `/essay/${string}` {
  const path = `/essay/${encodeURIComponent(blockId)}` as const;

  if (answer.status === "ready") {
    return path;
  }

  const value = answer.status === "writing" ? answer.generationId : toStartValue(answer.status);

  return `${path}?${new URLSearchParams({ [WRITING_START_PARAM]: value }).toString()}`;
}

export function readWritingStart(value: string | string[] | undefined): WritingStartState | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (value === LIMIT) {
    return { status: "limitReached" };
  }

  return value === FAILED ? { status: "failed" } : { generationId: value };
}
