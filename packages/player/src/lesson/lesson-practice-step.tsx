"use client";

import { type LessonPracticeRenderer } from "@zoonk/learn/mistakes/practice";
import { QuestionMainAction } from "@zoonk/learn/question-actions";
import { useMemo, useState } from "react";
import { WordBankCheckContext } from "../components/word-bank";
import { PlayerAudioProvider } from "../player-audio-context";
import { LessonPicturesProvider } from "./_components/lesson-pictures";
import { fromServerCheck, fromSpokenGrade } from "./_utils/lesson-results";
import { canSelfCorrect, getAnsweredStep } from "./_utils/lesson-steps";
import { BoardMissesContext } from "./feedback/board-misses";
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
import {
  type LessonPlayerAdapters,
  type LessonPlayerAnswer,
  type LessonStepResult,
  type PlayableLibraryStep,
} from "./lesson-player-types";
import { LessonStepView, showsOwnResult } from "./steps/lesson-step-view";
import { useIsQuietListening } from "./use-today-choice";

type Props = Parameters<LessonPracticeRenderer>[0] & Pick<LessonPlayerAdapters, "runCode">;

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
  const { actions, screen } = useLessonPlayer();
  const { primary } = screen;

  if (!primary) {
    return null;
  }

  return (
    <QuestionMainAction
      action={primary.label}
      busy={primary.busy}
      disabled={primary.disabled}
      enter="host"
      id="challenge-practice-action"
      onPress={() => runPrimary({ actions, screen })}
    />
  );
}

/** As in a lesson, a word bank places the feedback itself, so the bank holds still. */
function PracticeStepScreen({
  disabled,
  graded,
  notes,
  onAnswer,
  selected,
  step,
}: {
  disabled: boolean;
  graded: LessonStepResult | null;
  notes: React.ReactNode;
  onAnswer: (answer: LessonPlayerAnswer | null) => void;
  selected: LessonPlayerAnswer | undefined;
  step: PlayableLibraryStep;
}) {
  const answered = getAnsweredStep({ answer: selected, step });
  const inBank = canSelfCorrect(answered);
  const [boardMisses, setBoardMisses] = useState<React.ReactNode>(null);

  const resultView = graded && (!showsOwnResult(step) || !selected) && (
    <LessonStepResultView
      boardMisses={boardMisses}
      hyperdriveStreak={null}
      next={{ savePending: false, savedMistake: false, willReturn: false }}
      notes={notes}
      result={graded}
      step={answered}
    />
  );

  return (
    <>
      <WordBankCheckContext value={inBank ? resultView : null}>
        <BoardMissesContext value={setBoardMisses}>
          <LessonStepView
            answer={selected}
            isLocked={disabled || graded !== null}
            onAnswer={onAnswer}
            result={graded ?? undefined}
            step={step}
          />
        </BoardMissesContext>
      </WordBankCheckContext>
      {step.kind === "challenge" && !graded && <ChallengePracticeAction />}
      {!inBank && resultView}
      {graded && !resultView && notes}
    </>
  );
}

/** The notebook controls saving and progression; these are the lesson's original answer controls. */
export function LessonPracticeStep(props: Props) {
  const {
    answer,
    disabled,
    lesson,
    notes,
    onAnswer,
    onDontKnow,
    onCheck,
    onRecord,
    recordIssue,
    runCode,
  } = props;

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

  const isQuiet = useIsQuietListening(step.kind);

  const audioUrl =
    "exercise" in step && !isQuiet ? (step.exercise.sentence?.audioUrl ?? null) : null;

  function select(next: LessonPlayerAnswer | null) {
    if (!next || next.kind !== "hook") {
      onAnswer(next);
    }
  }

  return (
    <LessonPlayerConfigContext
      value={{
        adapters: { ...NO_ADAPTERS, runCode },
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
        outline: false,
        routes: {
          exit: "/mistakes",
          exitTo: null,
          mistakes: "/mistakes",
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
              <PracticeStepScreen
                disabled={disabled}
                graded={graded}
                notes={notes}
                onAnswer={select}
                selected={selected}
                step={step}
              />
            </PlayerAudioProvider>
          </LessonPicturesProvider>
        </LessonInteractionProvider>
      </LessonPlayerRuntimeContext>
    </LessonPlayerConfigContext>
  );
}
