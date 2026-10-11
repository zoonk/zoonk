"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { NoticeCardDescription } from "../_components/notice-card";
import {
  useListeningBasicsLine,
  useTopicsMovedLines,
  useTopicsMovedSentence,
} from "../plan/use-coverage-sentence";

/**
 * The notice topics a change the learner didn't make moved into or out of the plan, as a line of
 * its card: "Genetics no longer fits by your date." Covering less, or skipping lessons, names what
 * leaves and comes in; a card already long names fewer of them (`named`). Nothing when it moved
 * none.
 */
export function MovedTopicsLine({
  change,
  named,
}: {
  change: Pick<PlanChangeView, "effect">;
  named?: number;
}) {
  const sentence = useTopicsMovedSentence()(change, { named });
  return sentence ? <NoticeCardDescription>{sentence}</NoticeCardDescription> : null;
}

/**
 * What skipping lessons moved, under the card that says they were skipped: "Now in your plan: …"
 * and "Out of your plan: …", one line each. An IELTS learner's card said one topic no longer fits
 * and eight now fit, in one paragraph under "Lessons skipped". Nothing when it moved none.
 */
export function MovedTopicsLines({ change }: { change: Pick<PlanChangeView, "effect"> }) {
  const lines = useTopicsMovedLines()(change);

  return lines.map((line) => <NoticeCardDescription key={line}>{line}</NoticeCardDescription>);
}

/**
 * Why an exam's listening basics left with placement's answers, and how they're checked: "Your
 * answers show you know the basics of Listening. Practice with recordings will check them." An
 * IELTS learner saw "Out of your plan: Distinguish spoken English sounds" after answering only
 * text questions. Nothing for any other change.
 */
export function ListeningBasicsLine({ change }: { change: Pick<PlanChangeView, "effect"> }) {
  const line = useListeningBasicsLine()(change);
  return line ? <NoticeCardDescription>{line}</NoticeCardDescription> : null;
}
