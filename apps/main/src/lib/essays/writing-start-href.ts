import { type WritingStartAnswer } from "@zoonk/learn/writing";
import { type WritingStartState } from "@zoonk/learn/writing/start";

const WRITING_START_PARAM = "writing";

const LIMIT = "limit";
const FAILED = "failed";
const TASK_PARAM = "task";
const MINUTES_PARAM = "minutes";

type Search = Record<string, string | string[] | undefined>;

function startParams(answer: Exclude<WritingStartAnswer, { status: "ready" }>): string[][] {
  if (answer.status === "writing") {
    return [[WRITING_START_PARAM, answer.generationId]];
  }

  if (answer.status !== "limitReached") {
    return [[WRITING_START_PARAM, FAILED]];
  }

  // The refusal lists the task left for tomorrow, which the page can't read before a question is admitted.
  const task = answer.task
    ? [
        [TASK_PARAM, answer.task.description],
        [MINUTES_PARAM, String(answer.task.minutes)],
      ]
    : [];

  return [[WRITING_START_PARAM, LIMIT], ...task];
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

  return `${path}?${new URLSearchParams(startParams(answer)).toString()}`;
}

function readParam(search: Search, key: string): string | null {
  const value = search[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readWritingStart(search: Search): WritingStartState | null {
  const value = readParam(search, WRITING_START_PARAM);

  if (!value) {
    return null;
  }

  if (value === LIMIT) {
    const title = readParam(search, TASK_PARAM);
    const minutes = Number(readParam(search, MINUTES_PARAM));

    return {
      status: "limitReached",
      task: title
        ? { minutes: Number.isInteger(minutes) && minutes > 0 ? minutes : null, title }
        : null,
    };
  }

  return value === FAILED ? { status: "failed" } : { generationId: value };
}
