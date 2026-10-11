import { type ItemSetView } from "../library/items/item-set-view";
import { type ItemCitation } from "../library/sources/source-citation";
import { type DrillView } from "../mistakes/mistake-drills";
import { type SessionQuestion } from "./_utils/session-items";

/**
 * The learner's last answer to a capsule question before this session: when, whether it was right
 * and, only when it was wrong, the answer as text ("On Sep 30 you answered $18"). A right one is
 * never sent, since it would give today's answer away. Match answers have no single text, and a
 * math answer given with other numbers says nothing about today's, so those only say whether it
 * was right.
 */
export type TimeMachine = { answer: string | null; answeredAt: Date; isCorrect: boolean };

export type StudyBlockQuestion = SessionQuestion & {
  /**
   * Set once answered in this session: a checkpoint shows right or wrong without hints, and a
   * net-scored statement left blank counts as neither.
   */
  answered: { blank: boolean; isCorrect: boolean } | null;
  capsuleKey: string | null;
  /**
   * The passage the question quotes, such as an article of law, with its source's title, link and
   * the date it was last checked, for the dated "Sources" chip.
   */
  citation: ItemCitation | null;
  /** How a saved mistake's drill plays this question, by the mistake's cause. */
  drill: DrillView | null;
  mistakeId: string | null;
  /**
   * A placement question in the goal's first week: it fine-tunes where the plan starts, isn't
   * graded as learning, and welcomes "I don't know yet".
   */
  placement: boolean;
  /**
   * A real past exam question copied as printed, where its organizer allows it with the source
   * cited: it shows where it's from before it's answered.
   */
  quoted: boolean;
  /**
   * The text, case, chart or recording the question shares with the set's other questions, which
   * the block asks back to back; null for a question on its own.
   */
  set: ItemSetView | null;
  timeMachine: TimeMachine | null;
};
