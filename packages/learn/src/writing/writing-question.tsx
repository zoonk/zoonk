"use client";

import { type EssayView } from "@zoonk/core/exams/essays/contract";
import { type WritingPacing, type WritingPrompt } from "@zoonk/core/exams/essays/writing-contract";
import {
  Drawer,
  DrawerContent,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "../_components/list-group";
import { PageSectionTitle } from "../_components/page";
import { SheetHeader } from "../_components/sheet-header";
import { StepHeader, StepRow, StepRows, StepTitle } from "../_components/step-card";
import { TaskMeta } from "../_components/task-meta";
import { useFormatDuration } from "../_utils/time-format";
import { ESSAY_QUOTE_CLASS, useFormatScore } from "../essay/essay-labels";
import { ItemText } from "../questions/item-text";

export type WritingQuestion = Pick<EssayView, "context" | "question"> & {
  pacing?: WritingPacing;
  writing: WritingPrompt;
};

export function useWritingFacts({ pacing, writing }: Pick<WritingQuestion, "pacing" | "writing">) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatScore = useFormatScore();
  const time = pacing ? formatDuration(pacing.minutes) : null;

  return [
    writing.lines !== null &&
      t("{lines, plural, one {Up to # line} other {Up to # lines}}", { lines: writing.lines }),
    writing.points !== null && t("{points} points", { points: formatScore(writing.points) }),
    time && (pacing?.source === "official" ? time : t("about {time}", { time })),
  ];
}

function WritingCriteriaList({ writing }: { writing: WritingPrompt }) {
  const t = useExtracted();
  const formatScore = useFormatScore();

  return (
    <div className="flex flex-col gap-3">
      <StepRows>
        {writing.criteria.map((criterion) => (
          <StepRow key={criterion.id}>
            <span className="min-w-0 flex-1 text-pretty">{criterion.name}</span>
            {criterion.points !== null && (
              <span className="shrink-0 font-mono text-xs tabular-nums">
                {formatScore(criterion.points)}
              </span>
            )}
          </StepRow>
        ))}
      </StepRows>
      <p className="text-muted-foreground text-xs text-pretty">
        {writing.keySource === "notice"
          ? t("From the exam notice.")
          : t("From the exam notice. The answer key is ours, for practice.")}
      </p>
    </div>
  );
}

function useCriteriaDetail(writing: WritingPrompt): string {
  const t = useExtracted();
  const formatScore = useFormatScore();
  const scored = writing.criteria.some(({ points }) => points !== null);

  return scored && writing.points !== null
    ? t("How the {points} points are split", { points: formatScore(writing.points) })
    : t("What the answer is judged on");
}

/** The criteria under the question where it's read beside the answer: no sheet over a sheet. */
export function WritingCriteriaSection({ writing }: { writing: WritingPrompt }) {
  const t = useExtracted();

  return (
    <section className="flex flex-col gap-3">
      <PageSectionTitle>{t("Grading criteria")}</PageSectionTitle>
      <WritingCriteriaList writing={writing} />
    </section>
  );
}

/** How the question's points are split, one row away from it. */
export function WritingCriteriaSheet({ writing }: { writing: WritingPrompt }) {
  const t = useExtracted();
  const detail = useCriteriaDetail(writing);

  return (
    <ListGroup>
      <Drawer>
        <DrawerTrigger render={<ListRowButton />}>
          <ListRowContent>
            <ListRowTitle className="font-normal">{t("Grading criteria")}</ListRowTitle>
            <ListRowDescription>{detail}</ListRowDescription>
          </ListRowContent>
        </DrawerTrigger>
        <DrawerPopup>
          <SheetHeader>
            <DrawerTitle>{t("Grading criteria")}</DrawerTitle>
          </SheetHeader>
          <DrawerContent className="flex flex-col gap-4 pt-1">
            <p className="text-muted-foreground text-sm text-pretty">{detail}</p>
            <WritingCriteriaList writing={writing} />
          </DrawerContent>
        </DrawerPopup>
      </Drawer>
    </ListGroup>
  );
}

/** The support text and what to write: the question's body, on its screen and in the writer's sheet. */
export function WritingQuestionBody({
  className,
  question,
}: {
  className?: string;
  question: WritingQuestion;
}) {
  const t = useExtracted();

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {question.context && (
        <section className="flex flex-col gap-3">
          <PageSectionTitle>{t("Support text")}</PageSectionTitle>
          <ItemText
            className={cn(ESSAY_QUOTE_CLASS, "border-border text-sm leading-relaxed")}
            text={question.context}
          />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <PageSectionTitle>{t("What to write")}</PageSectionTitle>
        <ItemText className="text-reading leading-relaxed" text={question.question} />
      </section>
    </div>
  );
}

/** The question screen: its topic, limits, support text, what to write and the criteria. */
export function WritingQuestionScreen({ question }: { question: WritingQuestion }) {
  const facts = useWritingFacts(question);

  return (
    <div className="flex flex-col gap-8" data-slot="writing-question">
      <StepHeader className="gap-2">
        <StepTitle>{question.writing.title}</StepTitle>
        <TaskMeta facts={facts} />
      </StepHeader>
      <WritingQuestionBody question={question} />
      <WritingCriteriaSheet writing={question.writing} />
    </div>
  );
}
