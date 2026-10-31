import { type ItemSetView } from "../library/items/item-set-view";
import { type ItemCitation } from "../library/sources/source-citation";
import { type DrillView } from "../mistakes/mistake-drills";
import { type SessionQuestion } from "./_utils/session-items";

/** Never reveal prior right answers; match/order and numeric answers with different numbers have no useful answer text. */
export type TimeMachine = { answer: string | null; answeredAt: Date; isCorrect: boolean };

export type StudyBlockQuestion = SessionQuestion & {
  /** Blank net-scored statements count as neither right nor wrong. */
  answered: { blank: boolean; isCorrect: boolean } | null;
  capsuleKey: string | null;
  citation: ItemCitation | null;
  drill: DrillView | null;
  mistakeId: string | null;
  /** Diagnostic only: does not grade learning and accepts I don't know yet. */
  placement: boolean;
  /** Reproduced past questions must show their permitted source before answering. */
  quoted: boolean;
  /** Shared stimulus; null for standalone questions. */
  set: ItemSetView | null;
  timeMachine: TimeMachine | null;
};
