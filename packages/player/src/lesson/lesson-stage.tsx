"use client";

import { Eyebrow } from "@zoonk/learn/eyebrow";
import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CloudOffIcon, ImageIcon, PenOffIcon, PencilIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLayoutEffect } from "react";
import { SCREEN_TURN_CLASS, type ScreenTurn } from "../components/screen-turn";
import { FILL_SCREEN_CLASS, PlayerContentFrame } from "../components/step-layouts";
import { WordBankCheckContext } from "../components/word-bank";
import { LessonCitation } from "./_components/lesson-citation";
import { UpcomingPictures } from "./_components/lesson-pictures";
import { OrientationStrip } from "./_components/orientation-strip";
import { LESSON_CONTENT_ID, focusLessonAfterTurn } from "./_utils/lesson-focus";
import { canSelfCorrect, getAnsweredStep, isLanguageStep } from "./_utils/lesson-steps";
import { AskBuddyOffer } from "./controls/ask-buddy-offer";
import {
  type LessonResultNext,
  LessonResultNotes,
  OwnResultNotesContext,
} from "./feedback/lesson-result-notes";
import { LessonStepResultView } from "./feedback/lesson-step-result";
import { LessonRecapRow } from "./lesson-aside";
import { useLessonPlayer } from "./lesson-player-context";
import { type LessonScreen } from "./lesson-player-screen";
import { type LessonPlayerState } from "./lesson-player-state";
import { type LessonStepResult, type PlayableLibraryStep } from "./lesson-player-types";
import { LessonStepView, showsOwnResult } from "./steps/lesson-step-view";

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
      edge="end"
      onClick={() => {
        actions.restoreWriting();
        focusLessonAfterTurn();
      }}
      size="sm"
      variant="ghost"
    >
      {t("Turn back on")}
    </Button>
  );
}

function LessonNotice() {
  const t = useExtracted();
  const { screen, state } = useLessonPlayer();

  if (screen.quickCheck) {
    return (
      <PlayerContentFrame className="pt-4">
        <Eyebrow icon={<ZapIcon aria-hidden="true" />}>
          {t("Quick check · {current} of {total}", {
            current: String(screen.quickCheck.current + 1),
            total: String(screen.quickCheck.total),
          })}
        </Eyebrow>
      </PlayerContentFrame>
    );
  }

  switch (state.notice) {
    case "selfCorrect":
      // Drawn with what the check adds (`CheckAdditions`), so nothing above the answer moves.
      return null;
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
          {t("Writing is off for today.")}
        </NoticeLine>
      );
    case null:
      return null;
    default:
      return state.notice satisfies never;
  }
}

/** An activity's verdict is in its own card, so the lesson's notes go inside that card. */
function drawsOwnCard(step: PlayableLibraryStep): boolean {
  return step.kind === "activity";
}

type CheckAdditions = { feedback: boolean; selfCorrect: boolean };

/** What a check adds to the screen: "fix it yourself", its feedback, or both on a screen revisited. */
function getCheckAdditions({
  isShown,
  screen,
  state,
  step,
}: {
  isShown: boolean;
  screen: LessonScreen;
  state: LessonPlayerState;
  step: PlayableLibraryStep;
}): CheckAdditions | null {
  const selfCorrect = isShown && state.notice === "selfCorrect";
  const isChecked = isShown && state.phase === "feedback" && step.id in state.results;
  const feedback = isChecked && (!drawsOwnCard(step) || Boolean(screen.struggleOffer));
  return selfCorrect || feedback ? { feedback, selfCorrect } : null;
}

function SelfCorrectLine({ listening }: { listening: boolean }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm" role="status">
      <LineMarker>
        <PencilIcon aria-hidden="true" className="size-4" />
      </LineMarker>
      {listening ? t("Listen again") : t("Not quite. Look again and fix it yourself, then check.")}
    </p>
  );
}

function getResultNext({
  result,
  state,
  step,
}: {
  result: LessonStepResult;
  state: LessonPlayerState;
  step: PlayableLibraryStep;
}): LessonResultNext {
  const isMiss = !result.isCorrect;

  return {
    savePending: isMiss && Boolean(result.savePending) && !state.unsavedAnswers,
    savedMistake: isMiss && result.savedMistake,
    willReturn: isMiss && state.queue.includes(step.id, state.position + 1),
  };
}

function CheckFeedback({ step }: { step: PlayableLibraryStep }) {
  const { screen, state } = useLessonPlayer();
  const result = state.results[step.id];

  if (!result) {
    return null;
  }

  const next = getResultNext({ result, state, step });

  return (
    <>
      {showsOwnResult(step) ? (
        !drawsOwnCard(step) && (
          <LessonResultNotes hyperdriveStreak={screen.hyperdriveStreak} {...next} />
        )
      ) : (
        <LessonStepResultView
          hyperdriveStreak={screen.hyperdriveStreak}
          next={next}
          result={result}
          step={getAnsweredStep({ answer: state.answers[step.id], step })}
        />
      )}

      {screen.struggleOffer && <AskBuddyOffer reason="misses" />}
    </>
  );
}

function useOwnCardNotes({ isShown, step }: { isShown: boolean; step: PlayableLibraryStep }) {
  const { screen, state } = useLessonPlayer();
  const result = state.results[step.id];

  if (!isShown || !drawsOwnCard(step) || !result) {
    return null;
  }

  return { hyperdriveStreak: screen.hyperdriveStreak, ...getResultNext({ result, state, step }) };
}

function CheckAdded({ additions, step }: { additions: CheckAdditions; step: PlayableLibraryStep }) {
  const { state } = useLessonPlayer();
  const answered = getAnsweredStep({ answer: state.answers[step.id], step });

  return (
    <div className="flex flex-col gap-3">
      {additions.selfCorrect && <SelfCorrectLine listening={answered.kind === "listening"} />}
      {additions.feedback && <CheckFeedback step={step} />}
    </div>
  );
}

const PICTURES_AHEAD = 2;

export function LessonScreenFrame({
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
      className={cn("flex w-full flex-col", FILL_SCREEN_CLASS, turn && SCREEN_TURN_CLASS[turn])}
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

export function LessonStage({
  isShown,
  step,
  turn,
}: {
  isShown: boolean;
  step: PlayableLibraryStep;
  turn: ScreenTurn | null;
}) {
  const { actions, screen, state } = useLessonPlayer();
  const result = state.results[step.id];
  const answered = getAnsweredStep({ answer: state.answers[step.id], step });
  const additions = getCheckAdditions({ isShown, screen, state, step });
  const ownCardNotes = useOwnCardNotes({ isShown, step });
  const added = additions && <CheckAdded additions={additions} step={step} />;

  // A word bank places what a check adds itself, so it holds still; everywhere else it follows the screen.
  const inBank = canSelfCorrect(answered);

  return (
    <div className={cn("flex w-full flex-col", FILL_SCREEN_CLASS)} data-slot="lesson-stage">
      <OrientationStrip step={step} />
      {isShown && <LessonNotice />}

      <LessonScreenFrame turn={turn}>
        <WordBankCheckContext value={inBank ? added : null}>
          <OwnResultNotesContext value={ownCardNotes}>
            <LessonStepView
              answer={state.answers[step.id]}
              isLocked={isShown && state.phase !== "playing"}
              onAnswer={(answer) => actions.selectAnswer(step.id, answer)}
              result={result}
              step={step}
            />
          </OwnResultNotesContext>
        </WordBankCheckContext>
      </LessonScreenFrame>

      {isShown && !isLanguageStep(step) && <LessonCitation citation={step.citation} />}

      {added && !inBank && <PlayerContentFrame className="pb-6">{added}</PlayerContentFrame>}

      {isShown && <LessonRecapRow />}
      {isShown && <UpcomingPictures steps={getUpcomingSteps(state)} />}
    </div>
  );
}
