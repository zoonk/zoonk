"use client";

import { MAX_TYPED_PLACEMENT_ANSWER_LENGTH } from "@zoonk/core/learner/placement/placement-limits";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { Label } from "@zoonk/ui/components/label";
import { Textarea } from "@zoonk/ui/components/textarea";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { CircleHelpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
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

function TypedAnswerField({
  onChange,
  onSubmit,
  value,
}: {
  onChange: (value: string) => void;
  onSubmit: () => void;
  value: string;
}) {
  const t = useExtracted();
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId}>{t("Your answer, in your own words")}</Label>
      <Textarea
        autoFocus
        className="min-h-28 text-base"
        id={fieldId}
        maxLength={MAX_TYPED_PLACEMENT_ANSWER_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSubmit();
          }
        }}
        value={value}
      />
    </div>
  );
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
}: {
  canConfirm: boolean;
  dontKnowLabel: string;
  failures: number;
  onDontKnow: () => void;
  onStop: () => void;
  pending: boolean;
  pressed: PlacementControl | null;
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

      <Button
        busy={busy === "stop"}
        className="self-center"
        disabled={pending}
        focusableWhenDisabled
        onClick={onStop}
        type="button"
        variant="ghost"
      >
        {t("Stop here and see my plan")}
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
  subject,
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
  subject?: string;
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
            <OnboardingSubject position={t("Question {number, number}", { number })}>
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
          />
        </form>
      </OnboardingColumn>
    </OnboardingTestQuestion>
  );
}
