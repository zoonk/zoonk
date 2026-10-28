"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CloudOffIcon, ImageIcon, PenOffIcon, PencilIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLayoutEffect } from "react";
import { PlayerContentFrame } from "../components/step-layouts";
import { LessonCitation } from "./_components/lesson-citation";
import { UpcomingPictures } from "./_components/lesson-pictures";
import { LessonEyebrow } from "./_components/lesson-step-text";
import { LESSON_CONTENT_ID, focusLessonAfterTurn } from "./_utils/lesson-focus";
import { isLanguageStep } from "./_utils/lesson-steps";
import { AskBuddyOffer } from "./controls/ask-buddy-offer";
import { LessonResultNotes } from "./feedback/lesson-result-notes";
import { LessonStepResultView } from "./feedback/lesson-step-result";
import { LessonRecapRow } from "./lesson-aside";
import { useLessonPlayer } from "./lesson-player-context";
import { type LessonPlayerState } from "./lesson-player-state";
import { LessonStepView, showsOwnResult } from "./steps/lesson-step-view";
import { type ScreenTurn } from "./use-screen-turns";

function NoticeLine({
  action,
  children,
  icon,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <PlayerContentFrame className="flex items-center justify-between gap-3 pt-4">
      <p className="text-muted-foreground flex items-start gap-2 text-sm" role="status">
        <LineMarker>{icon}</LineMarker>
        {children}
      </p>
      {action}
    </PlayerContentFrame>
  );
}

function WriteAgainButton() {
  const t = useExtracted();
  const { actions, state } = useLessonPlayer();

  if (!state.writingRestore || state.phase !== "playing") {
    return null;
  }

  return (
    <Button
      className="-mr-2.5 shrink-0"
      onClick={() => {
        actions.restoreWriting();
        focusLessonAfterTurn();
      }}
      size="sm"
      variant="ghost"
    >
      {t("Write again")}
    </Button>
  );
}

function LessonNotice() {
  const t = useExtracted();
  const { screen, state } = useLessonPlayer();

  if (screen.quickCheck) {
    return (
      <PlayerContentFrame className="pt-4">
        <LessonEyebrow icon={<ZapIcon aria-hidden="true" />}>
          {t("Quick check · {current} of {total}", {
            current: String(screen.quickCheck.current + 1),
            total: String(screen.quickCheck.total),
          })}
        </LessonEyebrow>
      </PlayerContentFrame>
    );
  }

  switch (state.notice) {
    case "selfCorrect":
      return (
        <NoticeLine icon={<PencilIcon aria-hidden="true" className="size-4" />}>
          {t("Not quite. Look again and fix it yourself, then check.")}
        </NoticeLine>
      );
    case "answerNotSaved":
      return (
        <NoticeLine icon={<CloudOffIcon aria-hidden="true" className="size-4" />}>
          {t("Your answer here didn't save. Answer it again to finish the lesson.")}
        </NoticeLine>
      );
    case "pictureReady":
      return (
        <NoticeLine icon={<ImageIcon aria-hidden="true" className="size-4" />}>
          {t("This question was waiting for its picture. Answer it to finish the lesson.")}
        </NoticeLine>
      );
    case "writingSkipped":
      return (
        <NoticeLine
          action={<WriteAgainButton />}
          icon={<PenOffIcon aria-hidden="true" className="size-4" />}
        >
          {t("No more writing today.")}
        </NoticeLine>
      );
    case null:
      return null;
    default:
      return state.notice satisfies never;
  }
}

const PICTURES_AHEAD = 2;

const TURN_CLASS: Record<ScreenTurn, string> = {
  back: "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-8 motion-safe:duration-base motion-safe:ease-out",
  forward:
    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-8 motion-safe:duration-base motion-safe:ease-out",
};

function LessonScreenFrame({
  children,
  turn,
}: {
  children: React.ReactNode;
  turn: ScreenTurn | null;
}) {
  useLayoutEffect(() => {
    document.querySelector(`#${LESSON_CONTENT_ID}`)?.scrollTo({ top: 0 });
  }, []);

  return (
    <div
      className={cn("flex w-full flex-col", turn && TURN_CLASS[turn])}
      data-slot="lesson-screen"
      data-turn={turn ?? undefined}
    >
      {children}
    </div>
  );
}

function getUpcomingSteps(state: LessonPlayerState) {
  return state.queue
    .slice(state.position + 1, state.position + 1 + PICTURES_AHEAD)
    .flatMap((id) => state.steps[id] ?? []);
}

export function LessonStage({ turn }: { turn: ScreenTurn | null }) {
  const { actions, screen, state } = useLessonPlayer();
  const { step } = screen;

  if (!step) {
    return null;
  }

  const result = state.results[step.id];

  const next = result && {
    nextReviewAt: result.nextReviewAt,
    savedMistake: result.savedMistake && !result.isCorrect,
    willReturn: !result.isCorrect && state.queue.includes(step.id, state.position + 1),
  };

  return (
    <div className="flex w-full flex-col" data-slot="lesson-stage">
      <LessonNotice />

      <LessonScreenFrame key={`${step.id}-${state.position}`} turn={turn}>
        <LessonStepView
          answer={state.answers[step.id]}
          isLocked={state.phase !== "playing"}
          onAnswer={(answer) => actions.selectAnswer(step.id, answer)}
          result={result}
          step={step}
        />
      </LessonScreenFrame>

      {!isLanguageStep(step) && <LessonCitation citation={step.citation} />}

      {state.phase === "feedback" && result && next && (
        <PlayerContentFrame className="flex flex-col gap-3 pb-6">
          {showsOwnResult(step) ? (
            <LessonResultNotes hyperdriveStreak={screen.hyperdriveStreak} {...next} />
          ) : (
            <LessonStepResultView
              hyperdriveStreak={screen.hyperdriveStreak}
              next={next}
              result={result}
              step={step}
            />
          )}

          {screen.struggleOffer && <AskBuddyOffer reason="misses" />}
        </PlayerContentFrame>
      )}

      <LessonRecapRow />
      <UpcomingPictures steps={getUpcomingSteps(state)} />
    </div>
  );
}
