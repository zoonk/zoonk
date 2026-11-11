"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { CircleHelpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { AnswerOption, AnswerOptionGroup } from "../../_components/answer-option";
import { AnswersSaveError } from "../../_components/save-error";
import { getSentDurationMs } from "../../mistakes/drill/drill-types";
import { ItemLine, ItemStem, ItemSupport } from "../../questions/item-text";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import { useSpokenText } from "../../rich-text/use-spoken-text";
import { type Choice } from "../choice-list";
import { type PlacementAnswer, type PlacementQuestion } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingFooter,
  OnboardingHeading,
  OnboardingPrimaryButton,
  OnboardingSubject,
} from "../onboarding-frame";
import { OnboardingTestQuestion } from "../onboarding-host";
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

function PlacementActions({
  canConfirm,
  dontKnowLabel,
  failures,
  onDontKnow,
  onStop,
  pending,
  pressed,
  stopHint,
  stopLabel,
}: {
  canConfirm: boolean;
  dontKnowLabel: string;
  failures: number;
  onDontKnow: () => void;
  onStop: () => void;
  pending: boolean;
  pressed: PlacementControl | null;
  stopHint?: string;
  stopLabel: string;
}) {
  const t = useExtracted();
  const busy = pending ? pressed : null;

  return (
    <OnboardingFooter>
      {failures > 0 && !pending && <AnswersSaveError failures={failures} />}

      <div className="flex flex-wrap-reverse gap-2">
        <Button
          busy={busy === "dontKnow"}
          className="grow"
          disabled={pending}
          focusableWhenDisabled
          icon={<CircleHelpIcon aria-hidden="true" />}
          onClick={onDontKnow}
          size="lg"
          type="button"
          variant="outline"
        >
          {dontKnowLabel}
        </Button>
        <OnboardingPrimaryButton
          busy={busy === "confirm"}
          className="grow-999 basis-40"
          disabled={!canConfirm || pending}
          type="submit"
        >
          {t("Confirm")}
        </OnboardingPrimaryButton>
      </div>

      {stopHint && (
        <p className="text-muted-foreground pt-2 text-center text-sm text-pretty" role="status">
          {stopHint}
        </p>
      )}

      <Button
        busy={busy === "stop"}
        className="self-center"
        disabled={pending}
        focusableWhenDisabled
        onClick={onStop}
        type="button"
        variant="ghost"
      >
        {stopLabel}
      </Button>
    </OnboardingFooter>
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
  stopLabel,
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
  /** Said right above Stop, when stopping is worth suggesting. */
  stopHint?: string;
  stopLabel?: string;
  subject?: string;
  /** The count promised up front, when the test has one. */
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
      <OnboardingColumn>
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

          <div className="text-[1.1875rem] leading-[1.35] font-[560] tracking-[-0.02em] text-pretty">
            <ItemStem text={question.question} heading="h1" />
          </div>
        </OnboardingHeading>

        <form
          className="flex flex-1 flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
        >
          {question.format === "typed" ? (
            <TypedAnswerField onChange={setValue} onSubmit={confirm} value={value ?? ""} />
          ) : (
            <PlacementOptions
              choices={choices}
              label={spoken.blocks(question.question)}
              onChange={setValue}
              value={value}
            />
          )}

          <PlacementActions
            canConfirm={canConfirm}
            dontKnowLabel={dontKnowLabel ?? t("I don't know yet")}
            failures={failures}
            onDontKnow={() => send({ dontKnow: true }, "dontKnow")}
            onStop={() => {
              setPressed("stop");
              onStop();
            }}
            pending={pending}
            pressed={pressed}
            stopHint={stopHint}
            stopLabel={stopLabel ?? t("Stop here and see my plan")}
          />
        </form>
      </OnboardingColumn>
    </OnboardingTestQuestion>
  );
}
