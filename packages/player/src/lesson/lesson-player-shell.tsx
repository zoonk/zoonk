"use client";

import { getLessonCelebration } from "@zoonk/learn/session/lesson-celebration";
import { MomentAfterCeremony } from "@zoonk/learn/session/moment-ceremony";
import { getTaskAsideRootProps } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { PlayerAudioProvider } from "../player-audio-context";
import { getPlayerStepAudioUrl } from "../player-step";
import { LESSON_CONTENT_ID } from "./_utils/lesson-focus";
import { isLanguageStep } from "./_utils/lesson-steps";
import { LessonAccessScreen } from "./access/lesson-access-screen";
import { LessonCompletionMoment } from "./completion/lesson-completion-moment";
import { LessonCompletionReady } from "./completion/lesson-completion-ready";
import { useCompletionProps } from "./completion/use-completion-props";
import { LessonActionBar } from "./lesson-action-bar";
import { LessonAside } from "./lesson-aside";
import { LessonLeaveProvider } from "./lesson-leave";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { LessonPlayerHeader } from "./lesson-player-header";
import { type PlayableLibraryStep } from "./lesson-player-types";
import { LessonScreenMenu } from "./lesson-screen-menu";
import { LessonSounds } from "./lesson-sounds";
import { LessonStage } from "./lesson-stage";
import { useLessonKeyboard } from "./use-lesson-keyboard";
import { useRevealFeedback } from "./use-reveal-feedback";
import { useScreenTurn, useScreenTurns } from "./use-screen-turns";
import { useSwipeNavigation } from "./use-swipe-navigation";

function getPromptAudioUrl(step: PlayableLibraryStep | null): string | null {
  return step && isLanguageStep(step) ? getPlayerStepAudioUrl(step.exercise) : null;
}

function LessonCompletion() {
  const { slots } = useLessonPlayerConfig();
  const { actions, state } = useLessonPlayer();
  const props = useCompletionProps();

  if (state.completion?.status === "ready") {
    return <LessonCompletionReady onFinish={actions.retryCompletion} />;
  }

  if (!props) {
    return null;
  }

  return (
    <MomentAfterCeremony
      milestone={
        props.completion.result ? getLessonCelebration(props.completion.result).ceremony : null
      }
      render={slots.ceremony}
    >
      {slots.completion ? slots.completion(props) : <LessonCompletionMoment {...props} />}
    </MomentAfterCeremony>
  );
}

function LessonHeader() {
  const { slots } = useLessonPlayerConfig();
  const props = useCompletionProps();

  const completionHeader = props
    ? slots.completionHeader?.({ ...props, menu: <LessonScreenMenu /> })
    : null;

  return completionHeader ?? <LessonPlayerHeader />;
}

function LessonContent() {
  const { screen, state } = useLessonPlayer();
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const turn = useScreenTurn(state);
  const audioUrl = getPromptAudioUrl(screen.step);

  if (state.run.status === "refused") {
    return <LessonAccessScreen refusal={state.run.refusal} />;
  }

  if (state.phase === "completed") {
    return <LessonCompletion />;
  }

  return (
    <PlayerAudioProvider
      audioUrl={audioUrl}
      autoPlayAudio={autoPlayAudio}
      key={`${screen.step?.id}:${audioUrl ?? "no-audio"}`}
      onAutoPlayAudioEnabled={() => setAutoPlayAudio(true)}
    >
      <div className="flex flex-1 flex-col">
        <LessonStage turn={turn} />
      </div>
      <LessonActionBar />
    </PlayerAudioProvider>
  );
}

export function LessonPlayerShell() {
  return (
    <LessonLeaveProvider>
      <LessonPlayerFrame />
    </LessonLeaveProvider>
  );
}

function LessonPlayerFrame() {
  const t = useExtracted();
  const { state } = useLessonPlayer();
  const mainRef = useRef<HTMLElement>(null);
  const asideRoot = getTaskAsideRootProps();

  const turns = useScreenTurns();

  useLessonKeyboard();
  useRevealFeedback(mainRef);
  useSwipeNavigation({ onBack: turns.back, onForward: turns.forward, ref: mainRef });

  return (
    <div
      className={cn(
        "ph-no-rageclick bg-background flex h-dvh flex-col overflow-hidden",
        asideRoot.className,
      )}
      data-aside={asideRoot["data-aside"]}
      data-phase={state.phase}
      data-slot="lesson-player"
    >
      <LessonHeader />
      <LessonSounds />

      <main
        aria-label={t("Lesson content")}
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto outline-none"
        id={LESSON_CONTENT_ID}
        ref={mainRef}
        tabIndex={-1}
      >
        <div className="flex min-h-full flex-col">
          <LessonContent />
        </div>
      </main>

      <LessonAside />
    </div>
  );
}
