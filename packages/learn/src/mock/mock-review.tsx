"use client";

import { type MockReviewEntry } from "@zoonk/core/exams/mocks/view-contract";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { DetailsDrawer } from "../_components/details-drawer";
import { ItemCitationNote } from "../_components/item-citation";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemLine, ItemStem, ItemText } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { useMockScreen } from "./mock-context";
import { getOptionMarks } from "./mock-keys";
import { ResultSection } from "./mock-result-section";

/**
 * An answer's mark on its row, as the runner showed it where the review knows it: a statement's
 * letter (A for true, B for false), or its glyph where it's judged right or wrong. The review has
 * a pick's words but not its letter, so other answers are marked by how they went (`right`).
 */
function AnswerMark({
  answer,
  entry,
  right,
}: {
  answer: string;
  entry: MockReviewEntry;
  right: boolean;
}) {
  const { runner } = useMockScreen();
  const isStatement = entry.format === "trueFalse" && (answer === "true" || answer === "false");
  const marks = getOptionMarks({ format: entry.format, scoring: runner.view.scoring });

  if (isStatement && marks === "letters") {
    return answer === "true" ? "A" : "B";
  }

  if (isStatement) {
    return answer === "true" ? <CheckIcon /> : <XIcon />;
  }

  return right ? <CheckIcon /> : <XIcon />;
}

/**
 * The learner's answer and the right one as the answer rows they just used: their pick in red
 * ("Your answer"), the right answer in green ("Correct"); a statement's in the exam's words. A
 * blank says so instead of a row.
 */
function ReviewAnswers({ entry }: { entry: MockReviewEntry }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { answerText } = useTrueFalseLabels(runner.view.trueFalseLabels);
  const yours = entry.learnerAnswer;
  const right = entry.correctAnswer;

  return (
    <>
      {yours === null && <p className="text-muted-foreground text-sm">{t("You left it blank.")}</p>}

      <AnswerOptionGroup aria-label={t("Your answer and the right one")}>
        {yours !== null && (
          <AnswerOption
            disabled
            marker={<AnswerMark answer={yours} entry={entry} right={false} />}
            picked
            result="wrong"
          >
            <ItemLine text={answerText(yours) ?? yours} />
          </AnswerOption>
        )}
        {right !== null && (
          <AnswerOption
            disabled
            marker={<AnswerMark answer={right} entry={entry} right />}
            picked={false}
            result="right"
          >
            <ItemLine text={answerText(right) ?? right} />
          </AnswerOption>
        )}
      </AnswerOptionGroup>
    </>
  );
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

  return (
    <li className="border-border flex flex-col gap-3 border-b py-5 first:pt-0 last:border-b-0">
      {/* A mock runs in real conditions without menus; its questions are voted on in the review. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
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
      <div className="font-medium">
        <ItemStem text={entry.question} />
      </div>
      {entry.outcome === "partial" && (
        <p className="text-muted-foreground text-sm">
          {t("Partly right: it earned part of its points.")}
        </p>
      )}
      <ReviewAnswers entry={entry} />
      {entry.explanation && <ItemText className="text-sm" text={entry.explanation} />}
      {entry.citation && (
        <ItemCitationNote citation={entry.citation} className="text-muted-foreground" />
      )}
    </li>
  );
}

/**
 * The questions missed or left blank, in the mock's order, each with the learner's answer, the
 * right one and why.
 */
function MockReviewList() {
  const { runner } = useMockScreen();
  const { review } = runner.view;

  return (
    <ol className="flex flex-col">
      {review.map((entry, index) => (
        <ReviewEntry
          continued={entry.set !== null && review[index - 1]?.set?.id === entry.set.id}
          entry={entry}
          key={entry.itemId}
        />
      ))}
    </ol>
  );
}

/** The questions to review on the result's page, where a wide screen has room for them. */
export function MockReviewSection() {
  const t = useExtracted();
  const { runner } = useMockScreen();

  if (runner.view.review.length === 0) {
    return null;
  }

  return (
    <ResultSection title={t("Questions to review")}>
      <MockReviewList />
    </ResultSection>
  );
}

/**
 * The questions to review on a phone: a secondary beside Continue on the score's step, opening
 * them in a drawer from the bottom.
 */
export function MockReviewDrawer() {
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
      trigger="secondary"
    >
      <MockReviewList />
    </DetailsDrawer>
  );
}
