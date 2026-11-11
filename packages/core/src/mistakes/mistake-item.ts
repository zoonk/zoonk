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
const NO_EXTRAS = { left: null, right: null, select: null };

export function toMistakeQuestion(
  replay: ItemReplay,
): SessionQuestion & { set: ItemSetView | null } {
  const { item, math } = replay;
  const set = item.set ?? null;

  if (item.format !== "numeric") {
    return { ...toSessionQuestion({ blockId: item.id, item }), set };
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
}: {
  answer: QuestionAnswer;
  replay: ItemReplay;
}): GradedSessionAnswer {
  if (replay.item.format !== "numeric") {
    return gradeSessionAnswer({ answer, blockId: replay.item.id, item: replay.item });
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
