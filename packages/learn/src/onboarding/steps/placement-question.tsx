"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { Label } from "@zoonk/ui/components/label";
import { Textarea } from "@zoonk/ui/components/textarea";
import { CircleHelpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ItemLine, ItemText } from "../../questions/item-text";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import { type Choice, ChoiceList } from "../choice-list";
import { type PlacementAnswer, type PlacementQuestion } from "../onboarding-actions";
import {
  OnboardingColumn,
  OnboardingFooter,
  OnboardingPrimaryButton,
  OnboardingSubject,
} from "../onboarding-frame";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** A typed answer is a sentence or two; the grader looks for each key point. */
const MAX_TYPED_ANSWER = 1000;

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
      {
        icon: <span className="text-sm font-semibold">{LETTERS[0]}</span>,
        label: answerLabel(true),
        value: "true",
      },
      {
        icon: <span className="text-sm font-semibold">{LETTERS[1]}</span>,
        label: answerLabel(false),
        value: "false",
      },
    ];
  }

  return (question.options ?? []).map((option, index) => ({
    icon: <span className="text-sm font-semibold">{LETTERS[index]}</span>,
    label: option,
    value: String(index),
  }));
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

/**
 * A typed question, answered in the learner's own words: it confirms a skill a lucky pick could
 * otherwise skip. Enter sends it; Shift+Enter starts a new line.
 */
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
        className="in-data-[mode=fun]:fun-glass min-h-28 text-base"
        id={fieldId}
        maxLength={MAX_TYPED_ANSWER}
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

/**
 * One placement question: a choice, or a few words in the learner's own words to confirm a skill.
 * "I don't know yet" is a real answer: it moves to the basics instead of letting a guess skip
 * them. No score is shown.
 */
export function PlacementQuestionScreen({
  dontKnowLabel,
  error = null,
  media,
  number,
  onAnswer,
  onStop,
  pending,
  question,
  subject,
  trueFalseLabels = "trueFalse",
}: {
  /** What "I don't know" says for this question, such as "I didn't understand the audio". */
  dontKnowLabel?: string;
  /** Why the last answer didn't go through, such as a lost connection. */
  error?: string | null;
  /** Shown above the question, such as a voice message to listen to. */
  media?: React.ReactNode;
  /** This question's number: how many came before, with no total and no score. */
  number?: number;
  onAnswer: (answer: PlacementAnswer, durationMs: number) => void;
  /** "Stop anytime": the plan starts from what's known so far. */
  onStop: () => void;
  pending: boolean;
  question: PlacementQuestion;
  /** What the questions are about, such as "ENEM" or "quantum physics". */
  subject?: string;
  /** How true-or-false questions are answered: the goal's exam's words, or true or false. */
  trueFalseLabels?: TrueFalseLabels;
}) {
  const t = useExtracted();
  const choices = useQuestionChoices({ question, trueFalseLabels });
  const [value, setValue] = useState<string | null>(null);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const canConfirm = value !== null && value.trim().length > 0;

  const send = (answer: PlacementAnswer) => {
    const now = Date.now();
    setValue(null);
    setShownAt(now);
    onAnswer(answer, now - shownAt);
  };

  const confirm = () => {
    if (value !== null && canConfirm && !pending) {
      send(toAnswer({ question, value }));
    }
  };

  return (
    <OnboardingColumn>
      <form
        className="flex flex-1 flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        {subject && number !== undefined && (
          <div className="flex items-start justify-between gap-3">
            <OnboardingSubject>{subject}</OnboardingSubject>
            <span className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 shrink-0 py-1 text-xs font-medium tabular-nums">
              {t("Question {number, number}", { number })}
            </span>
          </div>
        )}

        {media}

        {question.context && (
          <ItemText
            className="text-muted-foreground text-base leading-relaxed"
            text={question.context}
          />
        )}

        <h1 className="in-data-[mode=fun]:font-fun-display text-xl leading-snug font-semibold text-pretty">
          <ItemLine text={question.question} />
        </h1>

        {question.format === "typed" ? (
          <TypedAnswerField onChange={setValue} onSubmit={confirm} value={value ?? ""} />
        ) : (
          <ChoiceList
            choices={choices}
            label={question.question}
            onChange={setValue}
            value={value}
          />
        )}

        <Button
          className="in-data-[mode=fun]:fun-glass h-12 rounded-full text-base"
          disabled={pending}
          onClick={() => send({ dontKnow: true })}
          type="button"
          variant="outline"
        >
          <CircleHelpIcon aria-hidden="true" />
          {dontKnowLabel ?? t("I don't know yet")}
        </Button>

        <OnboardingFooter>
          {error && (
            <p className="text-destructive text-center text-sm" role="alert">
              {error}
            </p>
          )}
          <OnboardingPrimaryButton disabled={!canConfirm || pending} type="submit">
            {t("Confirm")}
          </OnboardingPrimaryButton>
          <Button
            className="self-center"
            disabled={pending}
            onClick={onStop}
            type="button"
            variant="ghost"
          >
            {t("Stop here and see my plan")}
          </Button>
        </OnboardingFooter>
      </form>
    </OnboardingColumn>
  );
}
