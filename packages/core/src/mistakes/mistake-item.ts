import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { gradeMathAnswer, toMathQuestionView } from "../learner/_utils/math-items";
import { type ItemSetView } from "../library/items/item-set-view";
import {
  type GradedSessionAnswer,
  type SessionQuestion,
  gradeSessionAnswer,
  toSessionQuestion,
} from "../sessions/_utils/session-items";
import { type QuestionAnswer } from "../sessions/contract";
import { type MistakeReplay } from "./mistake-replay";

type ItemReplay = Extract<MistakeReplay, { kind: "item" }>;
const NO_EXTRAS = { key: null, left: null, right: null, select: null };

/**
 * One mistake on one of the learner's days: a mistake comes back on a later day, so each time it
 * does its options are in a new order, and a retry the same day reads the order it showed.
 */
export function getMistakeShowing({
  date,
  mistakeId,
  timeZone,
}: {
  date: Date;
  mistakeId: string;
  timeZone: string;
}): string {
  const day = getDateInTimeZone({ date, timeZone }).toISOString().slice(0, 10);
  return `mistake:${mistakeId}:${day}`;
}

export function toMistakeQuestion({
  replay,
  showing,
}: {
  replay: ItemReplay;
  showing: string;
}): SessionQuestion & { set: ItemSetView | null } {
  const { item, math } = replay;
  const set = item.set ?? null;

  if (item.format !== "numeric") {
    return { ...toSessionQuestion({ blockId: showing, item, revealMatchKey: true }), set };
  }

  if (!math) {
    throw new Error("A numeric mistake needs its original numbers");
  }

  return { ...NO_EXTRAS, ...toMathQuestionView({ item, version: math }), set };
}

/** Numeric replay grades the saved serving; all other formats use the ordinary session grader. */
export function gradeMistakeItem({
  answer,
  replay,
  showing,
}: {
  answer: QuestionAnswer;
  replay: ItemReplay;
  showing: string;
}): GradedSessionAnswer {
  if (replay.item.format !== "numeric") {
    return gradeSessionAnswer({ answer, blockId: showing, item: replay.item });
  }

  if (!replay.math) {
    throw new Error("A numeric mistake needs its original numbers");
  }

  return gradeMathAnswer({
    answer: "number" in answer ? answer.number : null,
    item: replay.item,
    version: replay.math,
  });
}
