"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
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
import { useScreenAtTop } from "../../_utils/use-screen-at-top";
import { getSentDurationMs } from "../../mistakes/drill/drill-types";
import { initialOrderAnswer } from "../../questions/initial-order-answer";
import { ItemSupport } from "../../questions/item-text";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import { useSpokenText } from "../../rich-text/use-spoken-text";
import { QuestionInputs } from "../../session/question-block/question-view";
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

function useTrueFalseChoices(trueFalseLabels: TrueFalseLabels) {
  const { answerLabel } = useTrueFalseLabels(trueFalseLabels);

  return [
    { label: answerLabel(true), value: true },
    { label: answerLabel(false), value: false },
  ];
}

/** A statement's title is the question itself, so it keeps the plain two options under it. */
function TrueFalseOptions({
  label,
  onChange,
  trueFalseLabels,
}: {
  label: string;
  onChange: (answer: PlacementAnswer) => void;
  trueFalseLabels: TrueFalseLabels;
}) {
  const choices = useTrueFalseChoices(trueFalseLabels);
  const [picked, setPicked] = useState<boolean | null>(null);

  const pick = (index: number) => {
    const choice = choices[index];

    if (choice) {
      setPicked(choice.value);
      onChange({ isTrue: choice.value });
    }
  };

  useNumberKeys({ count: choices.length, onPick: pick });

  return (
    <AnswerOptionGroup aria-label={label}>
      {choices.map((choice, index) => (
        <AnswerOption
          aria-keyshortcuts={shortcutKeys("pick", index)}
          key={String(choice.value)}
          marker={index + 1}
          onClick={() => pick(index)}
          picked={picked === choice.value}
        >
          {choice.label}
        </AnswerOption>
      ))}
    </AnswerOptionGroup>
  );
}

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
  dontKnowLabel,
  failures,
  media,
  number,
  onAnswer,
  onStop,
  pending,
  position,
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
  /** Where the question sits, over its title; "Question n of m" by default. */
  position?: string;
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
        // A question's title sits as far over its options as in a session and the wait's quiz.
        className="gap-5"
      >
        <OnboardingHeading>
          {subject && number !== undefined && (
            <OnboardingSubject
              position={
                position ??
                (total === undefined
                  ? t("Question {number, number}", { number })
                  : t("Question {number, number} of {total, number}", { number, total }))
              }
            >
              {subject}
            </OnboardingSubject>
          )}

          <div className="flex flex-col gap-5 pb-4 not-first:pt-4 empty:hidden">
            {media}
            <ItemSupport
              context={question.context}
              image={question.image}
              visual={question.visual}
            />
          </div>

          <QuestionTitle heading="h1" ref={title} tabIndex={-1} text={question.question} />
        </OnboardingHeading>

        {question.format === "trueFalse" ? (
          <TrueFalseOptions
            label={spoken.blocks(question.question)}
            onChange={setValue}
            trueFalseLabels={trueFalseLabels}
          />
        ) : (
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
            trueFalseLabels={trueFalseLabels}
          />
        )}

        {(number === undefined ? progress > 0 : number > 1) && (
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
