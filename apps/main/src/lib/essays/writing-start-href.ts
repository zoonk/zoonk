import { type WritingStartAnswer } from "@zoonk/learn/writing";
import { type WritingStartState } from "@zoonk/learn/writing/start";

const WRITING_START_PARAM = "writing";

const LIMIT = "limit";
const FAILED = "failed";
const TASK_REMOVED = "removed";
const TASK_PARAM = "task";
const MINUTES_PARAM = "minutes";
const LINES_PARAM = "lines";
const UNIT_PARAM = "unit";
const DRILL = "drill";

type Search = Record<string, string | string[] | undefined>;

function startParams(answer: Exclude<WritingStartAnswer, { status: "ready" }>): string[][] {
  if (answer.status === "writing") {
    return [
      [WRITING_START_PARAM, answer.generationId],
      ...(answer.unit === DRILL ? [[UNIT_PARAM, DRILL]] : []),
    ];
  }

  if (answer.status === "taskRemoved") {
    return [[WRITING_START_PARAM, TASK_REMOVED]];
  }

  if (answer.status !== "limitReached") {
    return [[WRITING_START_PARAM, FAILED]];
  }

  // The refusal lists the task left for tomorrow, which the page can't read before a question is admitted.
  const task = answer.task
    ? [
        [TASK_PARAM, answer.task.description],
        [MINUTES_PARAM, String(answer.task.minutes)],
        ...(answer.task.lines ? [[LINES_PARAM, String(answer.task.lines)]] : []),
        [UNIT_PARAM, answer.task.unit],
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

function readCount(search: Search, key: string): number | null {
  const value = Number(readParam(search, key));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function readUnit(search: Search): "answer" | "drill" {
  return readParam(search, UNIT_PARAM) === DRILL ? DRILL : "answer";
}

export function readWritingStart(search: Search): WritingStartState | null {
  const value = readParam(search, WRITING_START_PARAM);

  if (!value) {
    return null;
  }

  if (value === LIMIT) {
    const title = readParam(search, TASK_PARAM);

    return {
      status: "limitReached",
      task: title
        ? {
            lines: readCount(search, LINES_PARAM),
            minutes: readCount(search, MINUTES_PARAM),
            title,
            unit: readUnit(search),
          }
        : null,
    };
  }

  if (value === TASK_REMOVED) {
    return { status: "taskRemoved" };
  }

  return value === FAILED ? { status: "failed" } : { generationId: value, unit: readUnit(search) };
}
