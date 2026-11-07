"use client";

import {
  TASK_BACK_ACTION_CLASS,
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActionLabel,
  TaskActions,
} from "@zoonk/learn/task-layout";
import { Button, FORWARD_ICON } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { CheckIcon, ChevronLeftIcon, EyeIcon, HelpCircleIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ComponentProps } from "react";
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

/** Every label has its icon, busy or not, so the main action keeps one shape from screen to screen. */
const PRIMARY_ICONS: Record<
  LessonPrimaryLabel,
  Pick<ComponentProps<typeof Button>, "icon" | "iconPosition">
> = {
  check: { icon: <CheckIcon aria-hidden="true" /> },
  confirm: { icon: <CheckIcon aria-hidden="true" /> },
  continue: FORWARD_ICON,
  dontKnowYet: { icon: <HelpCircleIcon aria-hidden="true" /> },
  next: FORWARD_ICON,
  nextStep: FORWARD_ICON,
  seeAnswer: { icon: <EyeIcon aria-hidden="true" /> },
  seeHowItWent: FORWARD_ICON,
  start: { icon: <PlayIcon aria-hidden="true" /> },
};

function PrimaryLabel({ label }: { label: LessonPrimaryLabel }) {
  const t = useExtracted();

  const labels: Record<LessonPrimaryLabel, string> = {
    check: t("Check"),
    confirm: t("Confirm"),
    continue: t("Continue"),
    dontKnowYet: t("I don't know yet"),
    next: t("Next"),
    nextStep: t("Show the next step"),
    seeAnswer: t("See the answer"),
    seeHowItWent: t("See how it went"),
    start: t("Start"),
  };

  return <TaskActionLabel>{labels[label]}</TaskActionLabel>;
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
          busy={primary.busy}
          className={TASK_MAIN_ACTION_CLASS}
          disabled={primary.disabled}
          focusableWhenDisabled
          id={LESSON_PRIMARY_ID}
          onClick={() => runPrimary({ actions, screen })}
          size="xl"
          variant={isReveal ? "secondary" : "default"}
          {...PRIMARY_ICONS[primary.label]}
        >
          <PrimaryLabel label={primary.label} />
          <ShortcutKbd tone={isReveal ? undefined : "inverse"}>⏎</ShortcutKbd>
        </Button>

        <TutorAskButton quiet={Boolean(screen.struggleOffer)} />
      </TaskActions>
    </TaskActionBar>
  );
}
