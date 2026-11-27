"use client";

import { useExtracted } from "next-intl";
import { Eyebrow } from "../_components/eyebrow";
import { Surface } from "../_components/surface";
import { OnboardingDescription } from "../onboarding/onboarding-frame";
import { TestOutcome } from "../onboarding/test-outcome";
import { useSkippedLessonsSentences } from "../plan/use-skipped-lessons-sentences";
import { type ResultUndo, useResultUndo } from "../questions/undo-button";
import { type PlacementResultPhase } from "./placement-test-phase";
import { type TestPressed } from "./test-offer";

function SkipLead({
  held,
  lessons,
  said,
  undone,
}: {
  held: boolean;
  lessons: number;
  said: string;
  undone: boolean;
}) {
  const t = useExtracted();
  const sentences = useSkippedLessonsSentences();

  const kept =
    held && lessons === 0 ? t("You undid these today. Answer again tomorrow to skip them.") : said;

  return (
    <OnboardingDescription role="status">
      {undone ? sentences.back(lessons) : kept}
    </OnboardingDescription>
  );
}

export function UpNextLesson({ title }: { title: string }) {
  const t = useExtracted();

  return (
    <Surface className="flex flex-col gap-1 p-4">
      <Eyebrow className="self-start">{t("Up next")}</Eyebrow>
      <p className="font-medium [text-box:trim-end_cap_alphabetic]">{title}</p>
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
  onboarding,
  pressed,
  result,
  undo,
}: {
  failed: boolean;
  onDone: () => void;
  onStartLesson: (lessonId: string) => void;
  onboarding: boolean;
  pressed: TestPressed;
  result: PlacementResultPhase;
  undo: ResultUndo;
}) {
  const t = useExtracted();
  const sentences = useSkippedLessonsSentences();
  const { button, pending, undone } = useResultUndo(undo);
  const { lessonsSkipped } = result;
  const nextLesson = undone ? null : result.nextLesson;
  const action = useResultAction({ nextLesson, onboarding });
  const { lessonId } = action;

  return (
    <TestOutcome
      busy={pressed === "main"}
      continueLabel={action.label}
      disabled={pending}
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
      other={button(pressed !== null)}
      title={sentences.skipped(undone ? 0 : lessonsSkipped)}
    >
      {nextLesson && <UpNextLesson title={nextLesson.title} />}
    </TestOutcome>
  );
}
