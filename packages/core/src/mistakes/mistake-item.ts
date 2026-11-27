import { type Mistake } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
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
 * One mistake until its next miss: a mistake comes back only after another miss moves `missedAt`,
 * so each time it does its options are in a new order.
 */
export function getMistakeShowing(mistake: Pick<Mistake, "id" | "missedAt">): string {
  return `mistake:${mistake.id}:${mistake.missedAt.getTime()}`;
}

/** The showing a practice answer was given in, saved with it as `practiceShowing`; the current one for answers saved before it was. */
export function getAnsweredShowing({
  answer,
  mistake,
}: {
  answer: unknown;
  mistake: Pick<Mistake, "id" | "missedAt">;
}): string {
  return getString(answer, "practiceShowing") ?? getMistakeShowing(mistake);
}

/** What a practice answer saves beside the answer: its mistake and the showing it was given in. */
export function getPracticeAnswerKeys({
  mistake,
  showing = getMistakeShowing(mistake),
}: {
  mistake: Pick<Mistake, "id" | "missedAt">;
  showing?: string;
}) {
  return { practiceMistakeId: mistake.id, practiceShowing: showing };
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
