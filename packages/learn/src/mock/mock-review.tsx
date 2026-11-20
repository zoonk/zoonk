"use client";

import { type MockReviewEntry } from "@zoonk/core/exams/mocks/view-contract";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  FoldChevron,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { AnswerPair } from "../_components/answer-pair";
import { ItemCitationNote } from "../_components/item-citation";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
  ROW_FOLD_CLASS,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { FactSegments } from "../_components/task-meta";
import { ContentFeedbackMenu } from "../feedback/content-feedback-menu";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemLine, ItemText } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";

function ReviewAnswers({ entry, labels }: { entry: MockReviewEntry; labels: TrueFalseLabels }) {
  const { answerText } = useTrueFalseLabels(labels);
  const yours = entry.learnerAnswer;
  const right = entry.correctAnswer;

  const line = (text: string) =>
    entry.format === "typed" ? (
      text
    ) : (
      <ItemLine text={answerText({ answer: text, format: entry.format }) ?? text} />
    );

  return (
    <AnswerPair
      right={right === null ? null : line(right)}
      yours={yours === null ? null : line(yours)}
    />
  );
}

/** The row says which question it is and how it went; a wrong answer needs no word, the list is of them. */
function useEntryFacts() {
  const t = useExtracted();

  return (entry: MockReviewEntry): (string | null)[] => [
    t("Question {number}", { number: String(entry.number) }),
    entry.area,
    { blank: t("Blank"), partial: t("Partly right"), right: null, wrong: null }[entry.outcome],
  ];
}

function ReviewEntryBody({ entry, labels }: { entry: MockReviewEntry; labels: TrueFalseLabels }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3 pt-1 pb-3">
      {entry.set && <ItemSetStimulus continued={false} set={entry.set} />}
      {entry.context && (
        <ItemText className="text-muted-foreground text-reading" text={entry.context} />
      )}
      <ReviewAnswers entry={entry} labels={labels} />
      {entry.explanation && <ItemText className="text-reading" text={entry.explanation} />}

      <div className="-my-1 flex items-center justify-between gap-3">
        {entry.citation ? (
          <ItemCitationNote citation={entry.citation} className="text-muted-foreground flex-1" />
        ) : (
          <span />
        )}
        <ContentFeedbackMenu
          label={t("Question options")}
          screen="mock-review"
          target={{ contentId: entry.itemId, contentKind: "item" }}
        />
      </div>
    </div>
  );
}

function ReviewEntry({ entry, labels }: { entry: MockReviewEntry; labels: TrueFalseLabels }) {
  const facts = useEntryFacts();

  return (
    <li data-slot="mock-review-entry">
      <Collapsible>
        <CollapsibleTrigger className={cn(LIST_ROW_INTERACTIVE_CLASS, "items-center")}>
          <ListRowContent>
            <ListRowTitle className="text-pretty">
              <ItemLine text={entry.question} />
            </ListRowTitle>
            <ListRowDescription>
              <FactSegments facts={facts(entry)} />
            </ListRowDescription>
          </ListRowContent>
          <FoldChevron />
        </CollapsibleTrigger>
        <CollapsibleContent className={ROW_FOLD_CLASS}>
          <ReviewEntryBody entry={entry} labels={labels} />
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

/**
 * Every question the learner missed, as rows of one list: what each asked, and which it was. A row
 * opens in place to its passage, the two answers and why.
 */
export function MockReview({
  review,
  trueFalseLabels,
}: {
  review: readonly MockReviewEntry[];
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const titleId = useId();

  if (review.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={titleId} className="w-full gap-1" data-slot="mock-review">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("Questions to review")}</PageSectionTitle>
        <PageSectionDetail>{String(review.length)}</PageSectionDetail>
      </PageSectionHeader>

      <ListGroup>
        <ol>
          {review.map((entry) => (
            <ReviewEntry entry={entry} key={entry.itemId} labels={trueFalseLabels} />
          ))}
        </ol>
      </ListGroup>
    </PageSection>
  );
}
