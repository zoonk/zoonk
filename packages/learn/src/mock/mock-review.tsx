"use client";

import { type MockReviewEntry } from "@zoonk/core/exams/mocks/view-contract";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { DetailsDrawer } from "../_components/details-drawer";
import { Eyebrow } from "../_components/eyebrow";
import { ItemCitationNote } from "../_components/item-citation";
import { ContentFeedbackMenu } from "../feedback/content-feedback-menu";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemLine, ItemStem, ItemText } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { useMockScreen } from "./mock-context";
import { ResultSection } from "./mock-result-section";

function ReviewAnswers({ entry }: { entry: MockReviewEntry }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { answerText } = useTrueFalseLabels(runner.view.trueFalseLabels);
  const yours = entry.learnerAnswer;
  const right = entry.correctAnswer;

  return (
    <>
      {yours === null && (
        <p className="text-muted-foreground text-reading">{t("You left it blank.")}</p>
      )}

      <AnswerOptionGroup aria-label={t("Your answer and the right one")}>
        {yours !== null && (
          <AnswerOption disabled marker={<XIcon />} picked result="wrong">
            <ItemLine text={answerText(yours) ?? yours} />
          </AnswerOption>
        )}
        {right !== null && (
          <AnswerOption disabled marker={<CheckIcon />} picked={false} result="right">
            <ItemLine text={answerText(right) ?? right} />
          </AnswerOption>
        )}
      </AnswerOptionGroup>
    </>
  );
}

function ReviewEntry({ continued, entry }: { continued: boolean; entry: MockReviewEntry }) {
  const t = useExtracted();

  return (
    <li className="border-border flex flex-col gap-3 border-b py-5 first:pt-0 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>
          {entry.area
            ? t("Question {number} · {area}", { area: entry.area, number: String(entry.number) })
            : t("Question {number}", { number: String(entry.number) })}
        </Eyebrow>
        <ContentFeedbackMenu
          label={t("Question options")}
          screen="mock-review"
          target={{ contentId: entry.itemId, contentKind: "item" }}
        />
      </div>
      {entry.set && <ItemSetStimulus continued={continued} set={entry.set} />}
      {entry.context && (
        <ItemText className="text-muted-foreground text-reading" text={entry.context} />
      )}
      <div className="text-reading font-semibold">
        <ItemStem text={entry.question} />
      </div>
      {entry.outcome === "partial" && (
        <p className="text-muted-foreground text-reading">
          {t("Partly right: it earned part of its points.")}
        </p>
      )}
      <ReviewAnswers entry={entry} />
      {entry.explanation && <ItemText className="text-reading" text={entry.explanation} />}
      {entry.citation && (
        <ItemCitationNote citation={entry.citation} className="text-muted-foreground" />
      )}
    </li>
  );
}

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

export function MockReviewSection() {
  const t = useExtracted();
  const { runner } = useMockScreen();

  if (runner.view.review.length === 0) {
    return null;
  }

  return (
    <ResultSection rows title={t("Questions to review")}>
      <MockReviewList />
    </ResultSection>
  );
}

export function MockReviewDrawer() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { review } = runner.view;

  if (review.length === 0) {
    return null;
  }

  return (
    <DetailsDrawer label={t("See answers")} title={t("Questions to review")} trigger="small">
      <MockReviewList />
    </DetailsDrawer>
  );
}
