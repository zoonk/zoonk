"use client";

import {
  QuestionActions,
  QuestionBack,
  QuestionDontKnow,
  QuestionMainAction,
} from "@zoonk/learn/question-actions";
import { TaskActionBar } from "@zoonk/learn/task-layout";
import { PromptAudioButton } from "../components/prompt-audio-button";
import { usePromptAudio } from "../player-audio-context";
import { TutorAskButton } from "../questions/tutor-dock";
import { useIsRequiredPictureDrawing } from "./_components/lesson-pictures";
import {
  LESSON_BACK_ID,
  LESSON_PRIMARY_ID,
  focusLessonAfterTurn,
  pressKeepingFocus,
} from "./_utils/lesson-focus";
import { isReadStep } from "./_utils/lesson-steps";
import { isNumberAnswer } from "./_utils/number-answer";
import {
  type LessonPlayerActions,
  useLessonPlayer,
  useLessonPlayerConfig,
} from "./lesson-player-context";
import { type LessonScreen } from "./lesson-player-screen";

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

function PromptAudio() {
  const { screen } = useLessonPlayer();
  const audio = usePromptAudio();

  if (!audio || !screen.step || !isReadStep(screen.step)) {
    return null;
  }

  return <PromptAudioButton audio={audio} variant="icon" />;
}

/** A written answer can be given up; one that has its explanation ahead offers that first instead. */
function DontKnow() {
  const { actions, screen, state } = useLessonPlayer();
  const { showWritingAlternatives = true } = useLessonPlayerConfig();
  const { step } = screen;

  const offered =
    step?.kind === "typedAnswer" &&
    state.phase === "playing" &&
    showWritingAlternatives &&
    !screen.canExplainFirst &&
    !isNumberAnswer(step.content.acceptedAnswers);

  if (!offered) {
    return null;
  }

  return (
    <QuestionDontKnow
      onPress={() => {
        actions.dontKnow(step.id);
        focusLessonAfterTurn();
      }}
    />
  );
}

export function LessonActionBar() {
  const { actions, screen } = useLessonPlayer();
  const primary = useLessonPrimary();

  if (!primary) {
    return null;
  }

  return (
    <TaskActionBar>
      <QuestionActions>
        {screen.canGoBack && (
          <QuestionBack
            id={LESSON_BACK_ID}
            onClick={(event) => pressKeepingFocus(event, actions.goBack)}
          />
        )}

        <PromptAudio />
        <DontKnow />

        <QuestionMainAction
          action={primary.label}
          busy={primary.busy}
          disabled={primary.disabled}
          enter="host"
          id={LESSON_PRIMARY_ID}
          onClick={(event) => pressKeepingFocus(event, () => runPrimary({ actions, screen }))}
        />

        <TutorAskButton quiet={Boolean(screen.struggleOffer)} />
      </QuestionActions>
    </TaskActionBar>
  );
}
