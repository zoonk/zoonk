"use client";

import { type MockReviewEntry } from "@zoonk/core/exams/mocks/view-contract";
import { useExtracted } from "next-intl";
import { DetailsDrawer } from "../_components/details-drawer";
import { ItemCitationNote } from "../_components/item-citation";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemLine, ItemText } from "../questions/item-text";
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

function ReviewEntry({
  continued,
  entry,
}: {
  /** The entry before it reads the same text, so a phone folds this one. */
  continued: boolean;
  entry: MockReviewEntry;
}) {
  const t = useExtracted();
  const answerText = useAnswerText();

  return (
    <li className="border-border flex flex-col gap-2 rounded-2xl border p-4">
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
          votes={false}
        />
      </div>
      {entry.set && <ItemSetStimulus continued={continued} set={entry.set} />}
      {entry.context && <ItemText className="text-muted-foreground text-sm" text={entry.context} />}
      <p className="font-medium">
        <ItemLine text={entry.question} />
      </p>
      {entry.outcome === "partial" && (
        <p className="text-muted-foreground text-sm">
          {t("Partly right: it earned part of its points.")}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("Yours")}</dt>
        <dd>
          <ItemLine text={answerText(entry, entry.learnerAnswer)} />
        </dd>
        <dt className="text-muted-foreground">{t("Right answer")}</dt>
        <dd className="font-medium">
          <ItemLine text={answerText(entry, entry.correctAnswer)} />
        </dd>
      </dl>
      {entry.explanation && <ItemText className="text-sm" text={entry.explanation} />}
      {entry.citation && (
        <ItemCitationNote citation={entry.citation} className="text-muted-foreground" />
      )}
    </li>
  );
}

/**
 * The questions missed or left blank, each with the right answer and why, in the mock's order:
 * one text link away, in a sheet.
 */
export function MockReviewSheet() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { review } = runner.view;

  if (review.length === 0) {
    return null;
  }

  return (
    <DetailsDrawer
      label={t("{count, plural, one {See the question} other {See the # questions}}", {
        count: review.length,
      })}
      title={t("Questions to review")}
    >
      <ol className="flex flex-col gap-3">
        {review.map((entry, index) => (
          <ReviewEntry
            continued={entry.set !== null && review[index - 1]?.set?.id === entry.set.id}
            entry={entry}
            key={entry.itemId}
          />
        ))}
      </ol>
    </DetailsDrawer>
  );
}
