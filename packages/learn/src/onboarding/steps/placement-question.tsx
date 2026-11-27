"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
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
  OnboardingSubject,
} from "../onboarding-frame";
import { OnboardingTestQuestion } from "../onboarding-host";

function toPlacementAnswer(answer: StudyQuestionAnswer): PlacementAnswer | null {
  return "number" in answer || "text" in answer ? null : answer;
}

type PlacementControl = "confirm" | "dontKnow" | "stop";

function PlacementActions({
  canConfirm,
  dontKnowLabel,
  failures,
  onConfirm,
  onDontKnow,
  pending,
  pressed,
}: {
  canConfirm: boolean;
  dontKnowLabel?: string;
  failures: number;
  onConfirm: () => void;
  onDontKnow: () => void;
  pending: boolean;
  pressed: PlacementControl | null;
}) {
  const busy = pending ? pressed : null;

  return (
    <OnboardingBottomBar
      note={failures > 0 && !pending && <AnswersSaveError failures={failures} />}
    >
      <QuestionActions>
        <QuestionDontKnow busy={busy === "dontKnow"} disabled={pending} onPress={onDontKnow}>
          {dontKnowLabel}
        </QuestionDontKnow>
        <QuestionMainAction
          action="confirm"
          busy={busy === "confirm"}
          disabled={!canConfirm || pending}
          onPress={onConfirm}
        />
      </QuestionActions>
    </OnboardingBottomBar>
  );
}

function PlacementStop({
  busy,
  hint,
  onStop,
  pending,
}: {
  busy: boolean;
  hint?: string;
  onStop: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <>
      {hint && (
        <p className="text-muted-foreground text-sm" role="status">
          {hint}
        </p>
      )}
      <Button
        busy={busy}
        className="self-start"
        disabled={pending}
        focusableWhenDisabled
        onClick={onStop}
        type="button"
        variant="link"
      >
        {t("Stop and use my answers")}
      </Button>
    </>
  );
}

export function PlacementQuestionScreen({
  canStop,
  dontKnowLabel,
  failures,
  media,
  number,
  onAnswer,
  onClose,
  onStop,
  pending,
  position,
  progress,
  question,
  stopHint,
  subject,
  trueFalseLabels = "trueFalse",
}: {
  dontKnowLabel?: string;
  /** Saves from this screen (answers and Stop) that failed in a row. */
  failures: number;
  media?: React.ReactNode;
  /** Whether stopping now uses the answers given; from the second question when the test doesn't say. */
  canStop?: boolean;
  /** This question's number in the sitting, from 1. */
  number: number;
  onAnswer: (answer: PlacementAnswer, durationMs: number) => void;
  /** The learner pressed ✕ on this question. */
  onClose?: () => void;
  onStop: () => void;
  pending: boolean;
  /** Where the question sits in the test, on its own line under the chip. */
  position: readonly string[];
  /** 0 to 1. */
  progress: number;
  question: PlacementQuestion;
  stopHint?: string;
  /** What the question tests: a skill, a chapter, a subject. */
  subject: string;
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
  const titleProps = { heading: "h1", ref: title, tabIndex: -1 } as const;
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
    <OnboardingTestQuestion onClose={onClose} progress={progress}>
      <OnboardingScreenTop />
      <OnboardingColumn
        bar={
          <PlacementActions
            canConfirm={canConfirm}
            dontKnowLabel={dontKnowLabel}
            failures={failures}
            onConfirm={confirm}
            onDontKnow={() => send({ dontKnow: true }, "dontKnow")}
            pending={pending}
            pressed={pressed}
          />
        }
        // A question's title sits as far over its options as in a session and the wait's quiz.
        className="gap-5"
      >
        <OnboardingHeading>
          <OnboardingSubject position={position}>{subject}</OnboardingSubject>

          <div className="flex flex-col gap-5 pb-4 not-first:pt-4 empty:hidden">
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

        {(canStop ?? number > 1) && (
          <PlacementStop
            busy={pending && pressed === "stop"}
            hint={stopHint}
            onStop={() => {
              setPressed("stop");
              onStop();
            }}
            pending={pending}
          />
        )}
      </OnboardingColumn>
    </OnboardingTestQuestion>
  );
}
