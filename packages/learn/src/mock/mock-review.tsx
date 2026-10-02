"use client";

import { type MockReviewEntry } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { ItemCitationNote } from "../_components/item-citation";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { ItemLine } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { useMockScreen } from "./mock-context";

/** An answer as the learner saw it: a statement's in the exam's words, or left blank. */
function useAnswerText() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const trueFalse = useTrueFalseLabels(runner.view.trueFalseLabels);

  return (entry: MockReviewEntry, answer: string | null): string => {
    if (answer === null) {
      return t("Left blank");
    }

    return entry.format === "trueFalse" ? (trueFalse.answerText(answer) ?? answer) : answer;
  };
}

function ReviewEntry({ entry }: { entry: MockReviewEntry }) {
  const t = useExtracted();
  const answerText = useAnswerText();

  return (
    <li className="border-border in-data-[mode=fun]:fun-paper flex flex-col gap-2 rounded-2xl border p-4 in-data-[mode=fun]:border-transparent">
      {/* A mock runs in real conditions without menus; its questions are voted on in the review. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {entry.area
            ? t("Question {number} · {area}", { area: entry.area, number: String(entry.number) })
            : t("Question {number}", { number: String(entry.number) })}
        </p>
        <ContentVoteMenu
          label={t("Question options")}
          screen="mock-review"
          target={{ contentId: entry.itemId, contentKind: "item" }}
        />
      </div>
      <p className="font-medium">
        <ItemLine text={entry.question} />
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("Yours")}</dt>
        <dd>{answerText(entry, entry.learnerAnswer)}</dd>
        <dt className="text-muted-foreground">{t("Right answer")}</dt>
        <dd className="font-medium">{answerText(entry, entry.correctAnswer)}</dd>
      </dl>
      {entry.explanation && <p className="text-sm">{entry.explanation}</p>}
      {entry.citation && (
        <ItemCitationNote citation={entry.citation} className="text-muted-foreground" />
      )}
    </li>
  );
}

/** The questions missed or left blank, each with the right answer and why, in the mock's order. */
export function MockReview() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { review } = runner.view;

  if (review.length === 0) {
    return null;
  }

  return (
    <details className="group flex flex-col gap-3">
      <summary className="text-muted-foreground cursor-pointer py-3 text-sm font-medium">
        {t(
          "{count, plural, one {See the question to review} other {See the # questions to review}}",
          { count: review.length },
        )}
      </summary>
      <ol className="mt-3 flex flex-col gap-3">
        {review.map((entry) => (
          <ReviewEntry entry={entry} key={entry.itemId} />
        ))}
      </ol>
    </details>
  );
}
