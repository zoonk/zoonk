"use client";

import { useExtracted } from "next-intl";
import { type StudyBlockDetail } from "../session-types";
import { getNetTally } from "./net-tally";
import { type QuestionBlockState } from "./question-block-state";

/**
 * The net score of a Cebraspe-style capsule or practice, live: a wrong answer cancels a right one,
 * so "Leave blank" is there for statements the learner isn't sure about. The counts have a `=0`
 * case because Portuguese's "one" form also covers zero ("0 erros", not "0 erro").
 */
export function SwipeScore({
  answers,
  detail,
}: {
  answers: QuestionBlockState["answers"];
  detail: StudyBlockDetail;
}) {
  const t = useExtracted();
  const tally = getNetTally({ answers, questions: detail.questions });

  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      <ul className="flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums">
        <li className="bg-muted/60 rounded-full px-3 py-1.5">
          {t("{count, plural, =0 {# right} one {# right} other {# right}}", { count: tally.right })}
        </li>
        <li className="bg-muted/60 rounded-full px-3 py-1.5">
          {t("{count, plural, =0 {# wrong} one {# wrong} other {# wrong}}", { count: tally.wrong })}
        </li>
        <li className="bg-foreground text-background rounded-full px-3 py-1.5">
          {t("net {net}", { net: String(tally.right - tally.wrong) })}
        </li>
      </ul>
      <p className="text-muted-foreground text-xs">
        {t("A wrong answer cancels a right one. Not sure? Leave it blank.")}
      </p>
    </div>
  );
}
