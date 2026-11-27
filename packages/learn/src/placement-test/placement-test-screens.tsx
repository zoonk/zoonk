"use client";

import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { Eyebrow } from "../_components/eyebrow";
import { Surface } from "../_components/surface";
import { TaskMeta } from "../_components/task-meta";
import { type PlacementAttemptView } from "../onboarding/onboarding-actions";
import { OnboardingDescription, OnboardingSecondaryButton } from "../onboarding/onboarding-frame";
import { TestOutcome } from "../onboarding/test-outcome";
import { useSkippedLessonsSentences } from "../plan/use-skipped-lessons-sentences";
import { type ResultUndo, useResultUndo } from "../questions/undo-button";
import { useFullTestLabel } from "./placement-test-offers";
import { type PlacementResultPhase } from "./placement-test-phase";
import { type TestPressed } from "./test-offer";
import { useTestFacts } from "./use-test-facts";

function useSkipSentences() {
  const t = useExtracted();
  const sentences = useSkippedLessonsSentences();

  return {
    ...sentences,
    heldUntilTomorrow: t("You undid these today. Answer again tomorrow to skip them."),
    part: (count: number) =>
      t({
        description:
          "After one part of a test: how many lessons that part took out of the learner's plan.",
        message:
          "{count, plural, =0 {No lessons skipped in this part.} one {This part skipped # lesson you already know.} other {This part skipped # lessons you already know.}}",
        values: { count },
      }),
  };
}

function SkipLead({
  held,
  lessons,
  said,
  saved = false,
  undone,
}: {
  held: boolean;
  lessons: number;
  said: string;
  saved?: boolean;
  undone: boolean;
}) {
  const t = useExtracted();
  const sentences = useSkipSentences();
  const kept = held && lessons === 0 ? sentences.heldUntilTomorrow : said;

  return (
    <OnboardingDescription role="status">
      {undone ? sentences.back(lessons) : kept}
      {saved && ` ${t("Your answers are saved.")}`}
    </OnboardingDescription>
  );
}

type PartEnd = {
  attempt: PlacementAttemptView;
  failed: boolean;
  heldUntilTomorrow: boolean;
  lessonsSkipped: number;
  pressed: TestPressed;
  undo: ResultUndo;
};

/** The parts still to take and how long they take together: parts shrink as topics close. */
function usePartsLeftFacts() {
  const facts = useTestFacts();

  return (attempt: PlacementAttemptView): string[] => [
    facts.partsLeft(attempt.partsLeft),
    facts.about(attempt.remainingEstimatedMinutes),
  ];
}

/** A full test's part is done and others are left. */
export function PlacementCheckpoint({
  attempt,
  failed,
  heldUntilTomorrow,
  lessonsSkipped,
  onFinishLater,
  onKeepGoing,
  pressed,
  undo,
}: PartEnd & { onFinishLater: () => void; onKeepGoing: () => void }) {
  const t = useExtracted();
  const sentences = useSkipSentences();
  const partsLeft = usePartsLeftFacts();
  const { button, pending, undone } = useResultUndo(undo);

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={t("Keep going")}
      disabled={pending || pressed === "other"}
      failed={failed}
      lead={
        <SkipLead
          held={heldUntilTomorrow}
          lessons={lessonsSkipped}
          said={sentences.part(lessonsSkipped)}
          saved
          undone={undone}
        />
      }
      onContinue={onKeepGoing}
      other={
        <>
          {button(pressed !== null)}
          <OnboardingSecondaryButton
            busy={pressed === "other"}
            disabled={pending || pressed === "main"}
            onClick={onFinishLater}
          >
            {t("Finish later")}
          </OnboardingSecondaryButton>
        </>
      }
      title={t({
        description:
          "The title after one part of a test split into parts, such as “Part 3 of 14 done”.",
        message: "Part {part, number} of {parts, number} done",
        values: { part: attempt.part, parts: attempt.parts },
      })}
    >
      <TaskMeta facts={partsLeft(attempt)} />
    </TestOutcome>
  );
}

/** A full test the learner stopped midway: the answers count, and it says where they pick it up. */
export function PlacementStopped({
  attempt,
  doneLabel,
  failed,
  heldUntilTomorrow,
  lessonsSkipped,
  onDone,
  pressed,
  undo,
}: PartEnd & { doneLabel: string; onDone: () => void }) {
  const t = useExtracted();
  const facts = useTestFacts();
  const sentences = useSkipSentences();
  const { button, pending, undone } = useResultUndo(undo);
  const { parts, resume } = attempt;

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={doneLabel}
      disabled={pending}
      failed={failed}
      lead={
        <SkipLead
          held={heldUntilTomorrow}
          lessons={lessonsSkipped}
          said={sentences.part(lessonsSkipped)}
          undone={undone}
        />
      }
      onContinue={onDone}
      other={button(pressed !== null)}
      title={t("Your answers are saved")}
    >
      {resume && (
        <TaskMeta
          facts={[facts.nextTime({ part: resume.part, parts, question: resume.question })]}
        />
      )}
    </TestOutcome>
  );
}

export function UpNextLesson({ title }: { title: string }) {
  const t = useExtracted();

  return (
    <Surface className="flex flex-col gap-1 p-4">
      <Eyebrow className="self-start">{t("Up next")}</Eyebrow>
      <p className="font-medium [text-box:trim-end_cap_text]">{title}</p>
    </Surface>
  );
}

/** The main action a result offers on the Plan: the next lesson when it's known, else the way back. */
export function useResultAction({
  nextLesson,
  onboarding,
}: {
  nextLesson: { id: string; title: string } | null | undefined;
  onboarding: boolean;
}): { label: string; lessonId: string | null } {
  const t = useExtracted();

  if (onboarding) {
    return { label: t("Continue"), lessonId: null };
  }

  return nextLesson
    ? { label: t("Start lesson"), lessonId: nextLesson.id }
    : { label: t("Done"), lessonId: null };
}

export function PlacementResult({
  failed,
  onDone,
  onStartLesson,
  onTestTheRest,
  onboarding,
  pressed,
  result,
  undo,
}: {
  failed: boolean;
  onDone: () => void;
  onStartLesson: (lessonId: string) => void;
  onTestTheRest: () => void;
  onboarding: boolean;
  pressed: TestPressed;
  result: PlacementResultPhase;
  undo: ResultUndo;
}) {
  const t = useExtracted();
  const sentences = useSkipSentences();
  const partsLeft = usePartsLeftFacts();
  // The short test never mentioned parts, so what's left is named as the test the offer showed.
  const fullTest = useFullTestLabel();
  const { button, pending, undone } = useResultUndo(undo);
  const { attempt, lessonsSkipped } = result;
  const nextLesson = undone ? null : result.nextLesson;
  const action = useResultAction({ nextLesson, onboarding });
  const { lessonId } = action;
  const rest = attempt && attempt.partsLeft > 0 ? attempt : null;

  const others: ReactNode = (
    <>
      {button(pressed !== null)}
      {rest && (
        <OnboardingSecondaryButton
          busy={pressed === "other"}
          disabled={pending || pressed === "main"}
          onClick={onTestTheRest}
        >
          {t({
            description:
              "Button after the short test: goes on to test the rest of the course, in parts.",
            message: "Test the rest",
          })}
        </OnboardingSecondaryButton>
      )}
    </>
  );

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={action.label}
      disabled={pending || pressed === "other"}
      failed={failed}
      lead={
        <SkipLead
          held={result.heldUntilTomorrow}
          lessons={lessonsSkipped}
          said={
            lessonsSkipped > 0 ? sentences.known(lessonsSkipped) : t("Your plan stays as it is.")
          }
          undone={undone}
        />
      }
      onContinue={lessonId ? () => onStartLesson(lessonId) : onDone}
      other={others}
      title={sentences.skipped(undone ? 0 : lessonsSkipped)}
    >
      {rest && <TaskMeta facts={[fullTest, ...partsLeft(rest)]} />}
      {nextLesson && <UpNextLesson title={nextLesson.title} />}
    </TestOutcome>
  );
}
