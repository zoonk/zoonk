"use client";

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
import { ItemLine, ItemStem, ItemSupport } from "../../questions/item-text";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
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
      { label: answerLabel(true), value: "true" },
      { label: answerLabel(false), value: "false" },
    ];
  }

  return (question.options ?? []).map((option, index) => ({
    label: <ItemLine text={option} />,
    value: String(index),
  }));
}

/**
 * A placement question's options drawn as every question's are (the player's answer option): its
 * number on the left, the strong line, a firm ring once picked. Its number key picks it too.
 */
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
        className="min-h-28 text-base"
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
 * A question's actions: "I don't know yet" beside Confirm, as a session's placement question has
 * them, and stopping under them. A long "I don't know" puts Confirm on its own line above it rather
 * than squeezing it, so the main action still comes first.
 */
function PlacementActions({
  canConfirm,
  dontKnowLabel,
  onDontKnow,
  onRetry,
  onStop,
  pending,
}: {
  canConfirm: boolean;
  dontKnowLabel: string;
  onDontKnow: () => void;
  /** Sends the last answer again after its save failed; null while nothing failed. */
  onRetry: (() => void) | null;
  onStop: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <OnboardingFooter>
      {onRetry && <AnswersSaveError onRetry={onRetry} />}

      <div className="flex flex-wrap-reverse gap-2">
        <Button
          className="grow"
          disabled={pending}
          onClick={onDontKnow}
          size="lg"
          type="button"
          variant="outline"
        >
          <CircleHelpIcon aria-hidden="true" />
          {dontKnowLabel}
        </Button>
        <OnboardingPrimaryButton
          className="grow-999 basis-40"
          disabled={!canConfirm || pending}
          type="submit"
        >
          {t("Confirm")}
        </OnboardingPrimaryButton>
      </div>

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
  );
}

/**
 * One placement question: a choice, or a few words in the learner's own words to confirm a skill.
 * What it asks comes first (what it's about and its number, its support, the statement), then the
 * answer under it. "I don't know yet" is a real answer: it moves to the basics instead of letting
 * a guess skip them, and sits beside Confirm as it does on a session's placement question. No
 * score is shown, and an answer is final, so the bar has no way back, only how far into the test
 * the learner is: "Stop here" is the way on.
 */
export function PlacementQuestionScreen({
  dontKnowLabel,
  failed = false,
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
  /** What "I don't know" says for this question, such as "I didn't understand the audio". */
  dontKnowLabel?: string;
  /** The last answer didn't save (a lost connection): it stays picked, and Try again sends it. */
  failed?: boolean;
  /** Shown above the question, such as a voice message to listen to. */
  media?: React.ReactNode;
  /** This question's number: how many came before, with no total and no score. */
  number?: number;
  onAnswer: (answer: PlacementAnswer, durationMs: number) => void;
  /** "Stop anytime": the plan starts from what's known so far. */
  onStop: () => void;
  pending: boolean;
  /** How far into the test the learner is, from 0 to 1, shown in the bar. */
  progress: number;
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
  const [sent, setSent] = useState<{ answer: PlacementAnswer; durationMs: number } | null>(null);
  const canConfirm = value !== null && value.trim().length > 0;

  // The next question is a new screen (keyed by its item), so the pick stays while this one saves.
  const send = (answer: PlacementAnswer) => {
    const now = Date.now();
    setShownAt(now);
    setSent({ answer, durationMs: now - shownAt });
    onAnswer(answer, now - shownAt);
  };

  const confirm = () => {
    if (value !== null && canConfirm && !pending) {
      send(toAnswer({ question, value }));
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
              label={question.question}
              onChange={setValue}
              value={value}
            />
          )}

          <PlacementActions
            canConfirm={canConfirm}
            dontKnowLabel={dontKnowLabel ?? t("I don't know yet")}
            onDontKnow={() => send({ dontKnow: true })}
            onRetry={
              failed && sent && !pending ? () => onAnswer(sent.answer, sent.durationMs) : null
            }
            onStop={onStop}
            pending={pending}
          />
        </form>
      </OnboardingColumn>
    </OnboardingTestQuestion>
  );
}
