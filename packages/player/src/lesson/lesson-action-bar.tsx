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
import { PlayAudioButton } from "../components/play-audio-button";
import { usePromptAudioUrl } from "../player-audio-context";
import { TutorAskButton } from "../questions/tutor-dock";
import { LESSON_PRIMARY_ID } from "./_utils/lesson-focus";
import { isReadStep } from "./_utils/lesson-steps";
import { useLessonPlayer } from "./lesson-player-context";
import { type LessonPrimaryLabel } from "./lesson-player-screen";

function PrimaryLabel({ label }: { label: LessonPrimaryLabel }) {
  const t = useExtracted();

  const labels: Record<LessonPrimaryLabel, string> = {
    check: t("Check"),
    checking: t("Checking your answer"),
    confirm: t("Confirm"),
    continue: t("Continue"),
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
  const audioUrl = usePromptAudioUrl();

  if (!audioUrl || !screen.step || !isReadStep(screen.step)) {
    return null;
  }

  return <PlayAudioButton audioUrl={audioUrl} variant="icon" />;
}

export function LessonActionBar() {
  const t = useExtracted();
  const { actions, screen } = useLessonPlayer();
  const { primary } = screen;

  if (!primary) {
    return null;
  }

  const runPrimary = primary.action === "check" ? actions.check : actions.continue;

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
          onClick={runPrimary}
          size="xl"
        >
          {primary.busy && <Spinner aria-hidden="true" />}
          <PrimaryLabel label={primary.label} />
          {!primary.busy && <ShortcutKbd tone="inverse">⏎</ShortcutKbd>}
        </Button>

        <TutorAskButton quiet={Boolean(screen.struggleOffer)} />
      </TaskActions>
    </TaskActionBar>
  );
}
