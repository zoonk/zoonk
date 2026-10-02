"use client";

import { useExtracted } from "next-intl";
import { type StudyBlockDetail, type StudyQuestionAnswer } from "../session-types";
import { type QuestionBlockState } from "./question-block-state";

type Tally = { blank: number; right: number; wrong: number };

function isBlank(answer: StudyQuestionAnswer | undefined): boolean {
  return answer !== undefined && "dontKnow" in answer;
}

/**
 * Right, wrong and net so far. Answers from an earlier visit only say right or wrong, so a blank
 * left then reads as wrong until the block's end, where core counts it as neither.
 */
function getTally({
  answers,
  detail,
}: {
  answers: QuestionBlockState["answers"];
  detail: StudyBlockDetail;
}): Tally {
  const graded = detail.questions.flatMap((question) => {
    const now = answers[question.itemId];
    const isCorrect = now?.isCorrect ?? question.answered?.isCorrect;

    return isCorrect === undefined ? [] : [{ blank: isBlank(now?.answer), isCorrect }];
  });

  const right = graded.filter((answer) => answer.isCorrect).length;
  const blank = graded.filter((answer) => !answer.isCorrect && answer.blank).length;

  return { blank, right, wrong: graded.length - right - blank };
}

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
  const tally = getTally({ answers, detail });

  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      <ul className="flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums">
        <li className="bg-muted/60 in-data-[mode=fun]:fun-glass rounded-full px-3 py-1.5">
          {t("{count, plural, =0 {# right} one {# right} other {# right}}", { count: tally.right })}
        </li>
        <li className="bg-muted/60 in-data-[mode=fun]:fun-glass rounded-full px-3 py-1.5">
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
