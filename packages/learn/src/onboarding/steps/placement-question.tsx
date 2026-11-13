"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { AnswerOption, AnswerOptionGroup } from "../../_components/answer-option";
import {
  QuestionActions,
  QuestionDontKnow,
  QuestionMainAction,
} from "../../_components/question-actions";
import { QuestionTitle } from "../../_components/question-title";
import { AnswersSaveError } from "../../_components/save-error";
import { getSentDurationMs } from "../../mistakes/drill/drill-types";
import { ItemLine, ItemSupport } from "../../questions/item-text";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import { useSpokenText } from "../../rich-text/use-spoken-text";
import { type Choice } from "../choice-list";
import { type PlacementAnswer, type PlacementQuestion } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingHeading,
  OnboardingScreenTop,
  OnboardingSubject,
} from "../onboarding-frame";
import { OnboardingTestQuestion } from "../onboarding-host";
import { PlanStartNoticeSlot } from "./plan-start-notice";
import { TypedAnswerField } from "./typed-answer-field";

function useQuestionChoices({
  question,
  trueFalseLabels,
}: {
  question: PlacementQuestion;
  trueFalseLabels: TrueFalseLabels;
}): Choice<string>[] {
  const { answerLabel } = useTrueFalseLabels(trueFalseLabels);

  if (question.format === "trueFalse") {
    return [
      { label: answerLabel(true), value: "true" },
      { label: answerLabel(false), value: "false" },
    ];
  }

  return (question.options ?? []).map((option, index) => ({
    label: <ItemLine text={option} />,
    value: String(index),
  }));
}

function PlacementOptions({
  choices,
  label,
  onChange,
  value,
}: {
  choices: Choice<string>[];
  label: string;
  onChange: (value: string) => void;
  value: string | null;
}) {
  const pick = (index: number) => {
    const choice = choices[index];

    if (choice) {
      onChange(choice.value);
    }
  };

  useNumberKeys({ count: choices.length, onPick: pick });

  return (
    <AnswerOptionGroup aria-label={label}>
      {choices.map((choice, index) => (
        <AnswerOption
          aria-keyshortcuts={String(index + 1)}
          key={choice.value}
          marker={index + 1}
          onClick={() => onChange(choice.value)}
          picked={value === choice.value}
        >
          {choice.label}
        </AnswerOption>
      ))}
    </AnswerOptionGroup>
  );
}

function toAnswer({
  question,
  value,
}: {
  question: PlacementQuestion;
  value: string;
}): PlacementAnswer {
  if (question.format === "typed") {
    return { text: value.trim() };
  }

  return question.format === "trueFalse"
    ? { isTrue: value === "true" }
    : { selectedIndex: Number(value) };
}

type PlacementControl = "confirm" | "dontKnow" | "stop";

/** Pinned to the screen's bottom, as a lesson's are, so answering never needs a scroll. */
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
    <div className="flex flex-col gap-2">
      <PlanStartNoticeSlot />
      {failures > 0 && !pending && <AnswersSaveError failures={failures} />}

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
    </div>
  );
}

export function PlacementQuestionScreen({
  dontKnowLabel,
  failures,
  media,
  number,
  onAnswer,
  onStop,
  pending,
  progress,
  question,
  stopHint,
  subject,
  total,
  trueFalseLabels = "trueFalse",
}: {
  dontKnowLabel?: string;
  /** Saves from this screen (answers and Stop) that failed in a row. */
  failures: number;
  media?: React.ReactNode;
  number?: number;
  onAnswer: (answer: PlacementAnswer, durationMs: number) => void;
  onStop: () => void;
  pending: boolean;
  /** 0 to 1. */
  progress: number;
  question: PlacementQuestion;
  stopHint?: string;
  subject?: string;
  total?: number;
  trueFalseLabels?: TrueFalseLabels;
}) {
  const t = useExtracted();
  const spoken = useSpokenText();
  const choices = useQuestionChoices({ question, trueFalseLabels });
  const [value, setValue] = useState<string | null>(null);
  // oxlint-disable-next-line react/hook-use-state -- Read once as the question opens, never updated.
  const [shownAt] = useState(() => Date.now());
  // A saved answer opens the next question as a new screen (keyed by its item), so a send kept
  // here never saved.
  const [unsaved, setUnsaved] = useState<{ answer: PlacementAnswer; durationMs: number } | null>(
    null,
  );

  const [pressed, setPressed] = useState<PlacementControl | null>(null);
  const title = useRef<HTMLDivElement>(null);
  const isTyped = question.format === "typed";

  // The control that sent the last answer is gone, so focus would fall to the page. A typed answer's
  // field takes it instead.
  useEffect(() => {
    if (!isTyped) {
      title.current?.focus({ preventScroll: true });
    }
  }, [isTyped]);

  const canConfirm = value !== null && value.trim().length > 0;

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
    if (value !== null && canConfirm && !pending) {
      send(toAnswer({ question, value }), "confirm");
    }
  };

  return (
    <OnboardingTestQuestion progress={progress}>
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
      >
        <OnboardingHeading className="gap-5">
          {subject && number !== undefined && (
            <OnboardingSubject
              position={
                total === undefined
                  ? t("Question {number, number}", { number })
                  : t("Question {number, number} of {total, number}", { number, total })
              }
            >
              {subject}
            </OnboardingSubject>
          )}

          {media}

          <ItemSupport context={question.context} image={question.image} visual={question.visual} />

          <QuestionTitle heading="h1" ref={title} tabIndex={-1} text={question.question} />
        </OnboardingHeading>

        {isTyped ? (
          <TypedAnswerField onChange={setValue} onSubmit={confirm} value={value ?? ""} />
        ) : (
          <PlacementOptions
            choices={choices}
            label={spoken.blocks(question.question)}
            onChange={setValue}
            value={value}
          />
        )}

        {stopHint && (
          <p className="text-muted-foreground text-sm text-pretty" role="status">
            {stopHint}
          </p>
        )}

        <Button
          busy={pending && pressed === "stop"}
          className="-ml-3 self-start"
          disabled={pending}
          focusableWhenDisabled
          onClick={() => {
            setPressed("stop");
            onStop();
          }}
          type="button"
          variant="ghost"
        >
          {t("Stop and use my answers")}
        </Button>
      </OnboardingColumn>
    </OnboardingTestQuestion>
  );
}
