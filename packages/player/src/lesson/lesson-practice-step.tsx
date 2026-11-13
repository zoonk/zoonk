"use client";

import { type LessonPracticeRenderer } from "@zoonk/learn/mistakes/practice";
import { Button, FORWARD_ICON } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useMemo, useState } from "react";
import { PlayerAudioProvider } from "../player-audio-context";
import { LessonPicturesProvider } from "./_components/lesson-pictures";
import { fromServerCheck, fromSpokenGrade } from "./_utils/lesson-results";
import { getAnsweredStep } from "./_utils/lesson-steps";
import { LessonStepResultView } from "./feedback/lesson-step-result";
import { runPrimary } from "./lesson-action-bar";
import {
  type LessonPlayerActions,
  LessonPlayerConfigContext,
  LessonPlayerRuntimeContext,
  useLessonPlayer,
} from "./lesson-player-context";
import { LessonInteractionProvider } from "./lesson-player-interaction";
import { getLessonScreen } from "./lesson-player-screen";
import { type LessonPlayerState, createInitialState } from "./lesson-player-state";
import { type LessonPlayerAdapters, type LessonPlayerAnswer } from "./lesson-player-types";
import { LessonStepView, showsOwnResult } from "./steps/lesson-step-view";

type Props = Parameters<LessonPracticeRenderer>[0];

function idle() {
  return null;
}

const NO_ADAPTERS: LessonPlayerAdapters = {
  checkStep: async () => ({ status: "refused" }),
  completeLesson: async () => ({ status: "failed" }),
  startLesson: async () => ({ reason: "notFound" }),
};

function PlainLink({ children, ...props }: React.ComponentProps<"a">) {
  return <a {...props}>{children}</a>;
}

function getPracticeResult({ answer, lesson, result, spoken }: Props) {
  if (spoken) {
    return { ...fromSpokenGrade({ grade: spoken, step: lesson.step }), ...result };
  }

  if (!result) {
    return null;
  }

  const answerText = answer && "text" in answer ? answer.text : "";
  return fromServerCheck({ answerText, result });
}

function getPhase({
  disabled,
  graded,
}: {
  disabled: boolean;
  graded: boolean;
}): LessonPlayerState["phase"] {
  if (graded) {
    return "feedback";
  }

  return disabled ? "checking" : "playing";
}

function ChallengePracticeAction() {
  const t = useExtracted();
  const { actions, screen } = useLessonPlayer();
  const { primary } = screen;
  const labels = { confirm: t("Confirm"), seeResult: t("See how it went"), start: t("Start") };

  if (!primary) {
    return null;
  }

  const label = primary.label === "start" ? labels.start : labels.seeResult;

  return (
    <Button
      {...FORWARD_ICON}
      size="xl"
      disabled={primary.disabled}
      busy={primary.busy}
      onClick={() => runPrimary({ actions, screen })}
    >
      {primary.label === "confirm" ? labels.confirm : label}
    </Button>
  );
}

/** The notebook controls saving and progression; these are the lesson's original answer controls. */
export function LessonPracticeStep(props: Props) {
  const { answer, disabled, lesson, onAnswer, onDontKnow, onCheck, onRecord, recordIssue } = props;

  const { step } = lesson;
  const [shown, setShown] = useState(0);
  const selected = answer && "kind" in answer ? answer : undefined;

  const graded = getPracticeResult(props);

  const initial = useMemo(
    () => createInitialState({ hasMap: false, id: lesson.lessonId, steps: [step] }),
    [lesson.lessonId, step],
  );

  const state: LessonPlayerState = {
    ...initial,
    answers: selected ? { [step.id]: selected } : {},
    checkIssue: recordIssue,
    phase: getPhase({ disabled, graded: graded !== null }),
    results: graded ? { [step.id]: graded } : {},
    revealed: { [step.id]: shown },
  };

  const screen = { ...getLessonScreen(state), canExplainFirst: false };

  const actions: LessonPlayerActions = {
    check: () => {
      if (selected) {
        onCheck(selected);
      }
    },
    continue: () => {
      if (graded) {
        props.onContinue();
      } else {
        setShown(shown + 1);
      }
    },
    dontKnow: onDontKnow,
    engage: idle,
    explainFirst: idle,
    goBack: idle,
    knowThis: idle,
    restoreWriting: idle,
    retryCompletion: idle,
    retryStart: idle,
    selectAnswer: (_id, next) => {
      if (!next || next.kind !== "hook") {
        onAnswer(next);
      }
    },
    skipSteps: idle,
    skipWriting: onDontKnow,
    startRecording: idle,
    submitSpokenAnswer: onRecord ?? idle,
  };

  const audioUrl = "exercise" in step ? (step.exercise.sentence?.audioUrl ?? null) : null;

  function select(next: LessonPlayerAnswer | null) {
    if (!next || next.kind !== "hook") {
      onAnswer(next);
    }
  }

  return (
    <LessonPlayerConfigContext
      value={{
        adapters: NO_ADAPTERS,
        canRecordSpokenAnswer: Boolean(onRecord),
        challengeTeam: null,
        exampleLinesWriting: null,
        lesson: {
          estimatedMinutes: 0,
          id: lesson.lessonId,
          language: lesson.language,
          summary: null,
          targetLanguage: lesson.targetLanguage,
          title: "",
        },
        linkComponent: PlainLink,
        onExit: idle,
        outline: false,
        routes: {
          exit: "/mistakes",
          exitTo: null,
          nextLesson: null,
          seePlan: () => "/plan",
          signUp: "/login",
          upgrade: "/plus",
        },
        showWritingAlternatives: false,
        slots: {},
        soundsEnabled: false,
        track: idle,
      }}
    >
      <LessonPlayerRuntimeContext value={{ actions, played: state, screen, state }}>
        <LessonInteractionProvider>
          <LessonPicturesProvider
            getLessonPictures={undefined}
            onPicturesLost={idle}
            steps={[step]}
          >
            <PlayerAudioProvider audioUrl={audioUrl}>
              <LessonStepView
                answer={selected}
                isLocked={disabled || graded !== null}
                onAnswer={select}
                result={graded ?? undefined}
                step={step}
              />
              {step.kind === "challenge" && !graded && <ChallengePracticeAction />}
              {graded && (!showsOwnResult(step) || step.kind === "matchColumns" || !selected) && (
                <LessonStepResultView
                  hyperdriveStreak={null}
                  next={{ savedMistake: false, willReturn: false }}
                  result={graded}
                  step={getAnsweredStep({ answer: selected, step })}
                />
              )}
            </PlayerAudioProvider>
          </LessonPicturesProvider>
        </LessonInteractionProvider>
      </LessonPlayerRuntimeContext>
    </LessonPlayerConfigContext>
  );
}
