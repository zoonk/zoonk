"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useEffect, useRef, useState } from "react";
import {
  QuestionActions,
  QuestionDontKnow,
  QuestionMainAction,
} from "../../_components/question-actions";
import { QuestionTitle } from "../../_components/question-title";
import { AnswersSaveError } from "../../_components/save-error";
import { useScreenAtTop } from "../../_utils/use-screen-at-top";
import { getSentDurationMs } from "../../mistakes/drill/drill-types";
import { initialOrderAnswer } from "../../questions/initial-order-answer";
import { ItemSupport } from "../../questions/item-text";
import { QuestionInputs, drawsOwnTitle } from "../../session/question-block/question-view";
import { type StudyQuestionAnswer } from "../../session/session-types";
import { type PlacementAnswer, type PlacementQuestion } from "../onboarding-actions";
import {
  OnboardingBottomBar,
  OnboardingColumn,
  OnboardingHeading,
  OnboardingScreenTop,
} from "../onboarding-frame";
import { OnboardingTestQuestion } from "../onboarding-host";

function toPlacementAnswer(answer: StudyQuestionAnswer): PlacementAnswer | null {
  return "number" in answer || "text" in answer ? null : answer;
}

type PlacementControl = "confirm" | "dontKnow" | "stop";

/** The bar's second button where a question has its own, such as a listening question's. */
type SecondAction = {
  label: React.ReactNode;
  /** Pressed in place of answering "I don't know yet". */
  onPress?: () => void;
};

function PlacementActions({
  canConfirm,
  failures,
  onConfirm,
  onDontKnow,
  pending,
  pressed,
  second,
}: {
  canConfirm: boolean;
  failures: number;
  onConfirm: () => void;
  onDontKnow: () => void;
  pending: boolean;
  pressed: PlacementControl | null;
  second?: SecondAction;
}) {
  const busy = pending ? pressed : null;

  return (
    <OnboardingBottomBar
      note={failures > 0 && !pending && <AnswersSaveError failures={failures} />}
    >
      <QuestionActions>
        <QuestionDontKnow busy={busy === "dontKnow"} disabled={pending} onPress={onDontKnow}>
          {second?.label}
        </QuestionDontKnow>
        <QuestionMainAction
          action="confirm"
          // A stop sent from the ways out has no button of its own on this screen.
          busy={busy === "confirm" || busy === "stop"}
          disabled={!canConfirm || pending}
          onPress={onConfirm}
        />
      </QuestionActions>
    </OnboardingBottomBar>
  );
}

export function PlacementQuestionScreen({
  answered,
  canStop,
  failures,
  groups,
  media,
  onAnswer,
  onClose,
  onStop,
  pending,
  question,
  second,
  stopHint,
  subject,
  total,
  trueFalseLabels = "trueFalse",
}: {
  /** Questions answered before this one. */
  answered: number;
  /** Saves from this screen (answers and Stop) that failed in a row. */
  failures: number;
  /** The sizes of the test's sections in order, where it has them. */
  groups?: readonly number[];
  media?: React.ReactNode;
  /** Whether stopping now uses the answers given; from the second question when the test doesn't say. */
  canStop?: boolean;
  onAnswer: (answer: PlacementAnswer, durationMs: number) => void;
  /** The learner left from this question. */
  onClose?: () => void;
  onStop: () => void;
  pending: boolean;
  question: PlacementQuestion;
  second?: SecondAction;
  stopHint?: string;
  /** What the question tests: a skill, a chapter, a subject. */
  subject: string;
  /** The most questions the test asks. */
  total: number;
  trueFalseLabels?: TrueFalseLabels;
}) {
  const [value, setValue] = useState<PlacementAnswer | null>(() => initialOrderAnswer(question));
  // oxlint-disable-next-line react/hook-use-state -- Read once as the question opens, never updated.
  const [shownAt] = useState(() => Date.now());
  // A saved answer opens the next question as a new screen (keyed by its item), so a send kept
  // here never saved.
  const [unsaved, setUnsaved] = useState<{ answer: PlacementAnswer; durationMs: number } | null>(
    null,
  );

  const [pressed, setPressed] = useState<PlacementControl | null>(null);
  const title = useRef<HTMLDivElement>(null);
  // The header's title, what the question tests, is the screen's `h1`.
  const titleProps = { heading: "h2", ref: title, tabIndex: -1 } as const;
  useScreenAtTop(question.itemId);

  // The control that sent the last answer is gone, so focus would fall to the page.
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);

  const canConfirm = value !== null;

  const send = (answer: PlacementAnswer, control: PlacementControl) => {
    const durationMs = getSentDurationMs({
      answer,
      failed: unsaved,
      measuredMs: Date.now() - shownAt,
    });

    setPressed(control);
    setUnsaved({ answer, durationMs });
    onAnswer(answer, durationMs);
  };

  const confirm = () => {
    if (value !== null && !pending) {
      send(value, "confirm");
    }
  };

  return (
    <OnboardingTestQuestion
      answered={answered}
      groups={groups}
      onClose={onClose}
      onStop={
        (canStop ?? answered > 0)
          ? () => {
              setPressed("stop");
              onStop();
            }
          : undefined
      }
      stopHint={stopHint}
      stopWaits={pending}
      title={subject}
      total={total}
    >
      <OnboardingScreenTop />
      <OnboardingColumn
        bar={
          <PlacementActions
            canConfirm={canConfirm}
            failures={failures}
            onConfirm={confirm}
            onDontKnow={() => {
              if (second?.onPress) {
                setPressed("dontKnow");
                second.onPress();
                return;
              }

              send({ dontKnow: true }, "dontKnow");
            }}
            pending={pending}
            pressed={pressed}
            second={second}
          />
        }
        // A question's title sits as far over its options as in a session and the wait's quiz.
        className="gap-5"
      >
        <OnboardingHeading>
          <div className="flex flex-col gap-5 pb-4 empty:hidden">
            {media}
            <ItemSupport
              context={question.context}
              image={question.image}
              visual={question.visual}
            />
          </div>

          {!drawsOwnTitle(question.format) && (
            <QuestionTitle {...titleProps} text={question.question} />
          )}
        </OnboardingHeading>

        <QuestionInputs
          order={value && "order" in value ? value.order : undefined}
          allowBlank={false}
          disabled={pending}
          onChange={(answer) => setValue(answer && toPlacementAnswer(answer))}
          onSubmit={confirm}
          question={{
            entry: null,
            format: question.format,
            left: question.left ?? null,
            options: question.options,
            question: question.question,
            right: question.right ?? null,
            select: question.select ?? null,
            unit: null,
          }}
          result={null}
          title={titleProps}
          trueFalseLabels={trueFalseLabels}
        />
      </OnboardingColumn>
    </OnboardingTestQuestion>
  );
}
