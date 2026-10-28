"use client";

import { useExtracted } from "next-intl";
import { type StudyBlockDetail } from "../session-types";
import { getNetTally } from "./net-tally";
import { type QuestionBlockState } from "./question-block-state";

/** The counts have a `=0` case: Portuguese's "one" form also covers zero ("0 erros", not "0 erro"). */
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
    <div aria-live="polite" className="flex flex-col gap-1">
      <p className="text-muted-foreground font-mono text-[0.8125rem] tabular-nums">
        {t("{count, plural, =0 {# right} one {# right} other {# right}}", { count: tally.right })}
        {" · "}
        {t("{count, plural, =0 {# wrong} one {# wrong} other {# wrong}}", { count: tally.wrong })}
        {" · "}
        <span className="text-foreground font-medium">
          {t("net {net}", { net: String(tally.right - tally.wrong) })}
        </span>
      </p>
      <p className="text-muted-foreground text-xs">
        {t("A wrong answer cancels a right one. Not sure? Leave it blank.")}
      </p>
    </div>
  );
}
