"use client";

import {
  TASK_BACK_ACTION_CLASS,
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActions,
} from "@zoonk/learn/task-layout";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PromptAudioButton } from "../components/prompt-audio-button";
import { usePromptAudio } from "../player-audio-context";
import { TutorAskButton } from "../questions/tutor-dock";
import { useIsRequiredPictureDrawing } from "./_components/lesson-pictures";
import { LESSON_PRIMARY_ID } from "./_utils/lesson-focus";
import { isReadStep } from "./_utils/lesson-steps";
import { type LessonPlayerActions, useLessonPlayer } from "./lesson-player-context";
import { type LessonPrimaryLabel, type LessonScreen } from "./lesson-player-screen";

export function runPrimary({
  actions,
  screen,
}: {
  actions: LessonPlayerActions;
  screen: LessonScreen;
}): void {
  const { primary, step } = screen;

  if (primary?.action === "check") {
    actions.check();
  } else if (primary?.action === "reveal" && step) {
    actions.dontKnow(step.id);
  } else {
    actions.continue();
  }
}

/** A question's answer stays hidden while the numbered picture it asks about is drawing, as its options are locked. */
export function useLessonPrimary(): LessonScreen["primary"] {
  const { screen } = useLessonPlayer();
  const isPictureDrawing = useIsRequiredPictureDrawing(screen.step);
  const { primary } = screen;

  return primary && isPictureDrawing && primary.action !== "continue"
    ? { ...primary, disabled: true }
    : primary;
}

function PrimaryLabel({ label }: { label: LessonPrimaryLabel }) {
  const t = useExtracted();

  const labels: Record<LessonPrimaryLabel, string> = {
    check: t("Check"),
    checking: t("Checking your answer"),
    confirm: t("Confirm"),
    continue: t("Continue"),
    dontKnowYet: t("I don't know yet"),
    next: t("Next"),
    nextStep: t("Show the next step"),
    seeAnswer: t("See the answer"),
    seeHowItWent: t("See how it went"),
    start: t("Start"),
  };

  return labels[label];
}

function PromptAudio() {
  const { screen } = useLessonPlayer();
  const audio = usePromptAudio();

  if (!audio || !screen.step || !isReadStep(screen.step)) {
    return null;
  }

  return <PromptAudioButton audio={audio} variant="icon" />;
}

export function LessonActionBar() {
  const t = useExtracted();
  const { actions, screen } = useLessonPlayer();
  const primary = useLessonPrimary();

  if (!primary) {
    return null;
  }

  const isReveal = primary.action === "reveal";

  return (
    <TaskActionBar data-slot="lesson-action-bar">
      <TaskActions>
        {screen.canGoBack && (
          <Button
            aria-keyshortcuts="ArrowLeft"
            className={TASK_BACK_ACTION_CLASS}
            onClick={actions.goBack}
            size="icon"
            variant="outline"
          >
            <ChevronLeftIcon aria-hidden="true" />
            <span className="sr-only">{t("Previous screen")}</span>
          </Button>
        )}

        <PromptAudio />

        <Button
          aria-keyshortcuts="Enter"
          className={cn(TASK_MAIN_ACTION_CLASS, primary.busy && "disabled:opacity-100")}
          disabled={primary.disabled}
          id={LESSON_PRIMARY_ID}
          onClick={() => runPrimary({ actions, screen })}
          size="xl"
          variant={isReveal ? "outline" : "default"}
        >
          {primary.busy && <Spinner aria-hidden="true" />}
          <PrimaryLabel label={primary.label} />
          {!primary.busy && <ShortcutKbd tone={isReveal ? undefined : "inverse"}>⏎</ShortcutKbd>}
        </Button>

        <TutorAskButton quiet={Boolean(screen.struggleOffer)} />
      </TaskActions>
    </TaskActionBar>
  );
}
