"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CloudOffIcon, ImageIcon, PenOffIcon, PencilIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLayoutEffect } from "react";
import { PlayerContentFrame } from "../components/step-layouts";
import { LessonCitation } from "./_components/lesson-citation";
import { UpcomingPictures } from "./_components/lesson-pictures";
import { LessonEyebrow } from "./_components/lesson-step-text";
import { LESSON_CONTENT_ID } from "./_utils/lesson-focus";
import { isLanguageStep } from "./_utils/lesson-steps";
import { AskBuddyOffer } from "./controls/ask-buddy-offer";
import { LessonResultNotes } from "./feedback/lesson-result-notes";
import { LessonStepResultView } from "./feedback/lesson-step-result";
import { useLessonPlayer } from "./lesson-player-context";
import { type LessonPlayerState } from "./lesson-player-state";
import { LessonStepView, showsOwnResult } from "./steps/lesson-step-view";
import { type ScreenTurn } from "./use-screen-turns";

/** A quiet line over the screen it's about, its icon before it, read out when it shows. */
function NoticeLine({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <PlayerContentFrame className="pt-4">
      <p className="text-muted-foreground flex items-start gap-2 text-sm" role="status">
        <LineMarker>{icon}</LineMarker>
        {children}
      </p>
    </PlayerContentFrame>
  );
}

/**
 * "I know this" in progress, a language answer to fix first, an answer that didn't save, a
 * question that waited for its picture, or writing left out of the rest of the lesson.
 */
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
        <NoticeLine icon={<PenOffIcon aria-hidden="true" className="size-4" />}>
          {t("No more writing in this lesson.")}
        </NoticeLine>
      );
    case null:
      return null;
    default:
      return state.notice satisfies never;
  }
}

/** How many screens ahead the player fetches pictures, so turning a screen never waits on one. */
const PICTURES_AHEAD = 2;

/**
 * A new screen slides in from the side the learner is heading, like turning a story: from the
 * right going on, from the left going back, on every screen size, since all of a screen is in its
 * column. Reduced motion shows it in place.
 */
const TURN_CLASS: Record<ScreenTurn, string> = {
  back: "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-8 motion-safe:duration-200 motion-safe:ease-out",
  forward:
    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-8 motion-safe:duration-200 motion-safe:ease-out",
};

/**
 * One screen of the lesson, sliding in from the side the learner turned to. It starts at its top,
 * like a turned page: the screen before, scrolled down to its result or its last line, never
 * leaves this one scrolled past its picture.
 */
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

/**
 * The screen in view and, after a check, its result right under it on the feedback panel, so the
 * answered question stays in view. The screen keeps its place in both phases, so its state
 * survives the check; a screen that shows its own result, like an activity, gets only the panel's
 * quiet last line under it. Every screen
 * starts at the top, like a page, so nothing jumps from one screen to the next, and the next
 * screens' pictures load while this one is read.
 */
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
      {/* Right above the question it's about, not floating at the top of the screen. */}
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
          {/* A screen with its own result gets the panel's last line under it, quietly. */}
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

      <UpcomingPictures steps={getUpcomingSteps(state)} />
    </div>
  );
}
