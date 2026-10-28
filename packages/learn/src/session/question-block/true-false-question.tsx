"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useKeyboardCallback, useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { AnswerOption, AnswerOptionGroup } from "../../_components/answer-option";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import { parseRichBlocks } from "../../rich-text/rich-text-parser";
import { QuestionTitle } from "./question-title";

const SWIPE_THRESHOLD_PX = 90;
const TILT_DEGREES_PER_PX = 0.06;

type TrueFalseAnswer = { dontKnow: true } | { isTrue: boolean };

export type TrueFalseResult = { answer: TrueFalseAnswer; correct: boolean | null };

type Option = { answer: TrueFalseAnswer; key: "blank" | "false" | "true"; keys: string };

const FALSE_OPTION: Option = { answer: { isTrue: false }, key: "false", keys: "ArrowLeft" };
const TRUE_OPTION: Option = { answer: { isTrue: true }, key: "true", keys: "ArrowRight" };
const BLANK_OPTION: Option = { answer: { dontKnow: true }, key: "blank", keys: "ArrowDown" };

/** In reading order, so the number keys follow them: false, blank, true. */
const THREE_OPTIONS = [FALSE_OPTION, BLANK_OPTION, TRUE_OPTION];
const TWO_OPTIONS = [FALSE_OPTION, TRUE_OPTION];

const SCREEN_KEY = { mode: "none", screen: true } as const;

function isSameAnswer(a: TrueFalseAnswer | null, b: TrueFalseAnswer): boolean {
  if (!a) {
    return false;
  }

  return "isTrue" in a ? "isTrue" in b && a.isTrue === b.isTrue : "dontKnow" in b;
}

function getOptionResult({ option, result }: { option: Option; result: TrueFalseResult | null }) {
  if (!result) {
    return null;
  }

  if (
    result.correct !== null &&
    "isTrue" in option.answer &&
    option.answer.isTrue === result.correct
  ) {
    return "right";
  }

  // A blank is neither right nor wrong: it stays picked, never red.
  return isSameAnswer(result.answer, option.answer) && "isTrue" in option.answer ? "wrong" : null;
}

function isShown({ option, result }: { option: Option; result: TrueFalseResult | null }) {
  if (!result) {
    return true;
  }

  return getOptionResult({ option, result }) !== null || isSameAnswer(result.answer, option.answer);
}

function useSwipe({ enabled, onSwipe }: { enabled: boolean; onSwipe: (isTrue: boolean) => void }) {
  const [drag, setDrag] = useState<{ originX: number; x: number } | null>(null);
  const offset = drag ? drag.x - drag.originX : 0;

  return {
    handlers: {
      onPointerCancel: () => setDrag(null),
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        if (!enabled) {
          return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ originX: event.clientX, x: event.clientX });
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        setDrag((current) => (current ? { ...current, x: event.clientX } : current));
      },
      onPointerUp: () => {
        setDrag(null);

        if (Math.abs(offset) >= SWIPE_THRESHOLD_PX) {
          onSwipe(offset > 0);
        }
      },
    },
    offset,
  };
}

export function TrueFalseQuestion({
  allowBlank,
  disabled,
  onChange,
  result,
  statement,
  trueFalseLabels,
}: {
  allowBlank: boolean;
  disabled: boolean;
  onChange: (answer: TrueFalseAnswer | null) => void;
  result: TrueFalseResult | null;
  statement: string;
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const { answerLabel } = useTrueFalseLabels(trueFalseLabels);
  const [picked, setPicked] = useState<TrueFalseAnswer | null>(null);
  const locked = disabled || result !== null;
  const hasTable = parseRichBlocks(statement).some((block) => block.kind === "table");
  const canSwipe = !locked && !hasTable;
  const options = allowBlank ? THREE_OPTIONS : TWO_OPTIONS;
  const shownPick = result?.answer ?? picked;

  const pick = (answer: TrueFalseAnswer) => {
    const next = isSameAnswer(picked, answer) ? null : answer;
    setPicked(next);
    onChange(next);
  };

  // A swipe or an arrow picks its side, and doing it again keeps it picked.
  const pickSide = (answer: TrueFalseAnswer) => {
    setPicked(answer);
    onChange(answer);
  };

  const swipe = useSwipe({ enabled: canSwipe, onSwipe: (isTrue) => pickSide({ isTrue }) });
  const sideKey = (option: Option) => () => (locked ? false : pickSide(option.answer));

  useKeyboardCallback("ArrowLeft", sideKey(FALSE_OPTION), SCREEN_KEY);
  useKeyboardCallback("ArrowRight", sideKey(TRUE_OPTION), SCREEN_KEY);
  useKeyboardCallback("ArrowDown", allowBlank ? sideKey(BLANK_OPTION) : () => false, SCREEN_KEY);

  useNumberKeys({
    count: options.length,
    enabled: !locked,
    onPick: (index) => {
      const option = options[index];

      if (!option) {
        return false;
      }

      pick(option.answer);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "bg-card ring-border flex min-h-32 w-full items-start rounded-xl p-5 text-left ring-1 select-none ring-inset",
          "motion-safe:transition-transform",
          hasTable ? "touch-auto" : "touch-pan-y",
          canSwipe && "cursor-grab active:cursor-grabbing",
        )}
        style={{
          transform: swipe.offset
            ? `translateX(${swipe.offset}px) rotate(${swipe.offset * TILT_DEGREES_PER_PX}deg)`
            : undefined,
        }}
        {...swipe.handlers}
      >
        <QuestionTitle className="min-w-0 flex-1" muted={result !== null} text={statement} />
      </div>

      <AnswerOptionGroup>
        {options.map((option, index) =>
          isShown({ option, result }) ? (
            <AnswerOption
              aria-keyshortcuts={`${option.keys} ${index + 1}`}
              disabled={locked}
              key={option.key}
              marker={index + 1}
              onClick={() => pick(option.answer)}
              picked={isSameAnswer(shownPick, option.answer)}
              result={getOptionResult({ option, result })}
            >
              {"isTrue" in option.answer ? answerLabel(option.answer.isTrue) : t("Leave blank")}
            </AnswerOption>
          ) : null,
        )}
      </AnswerOptionGroup>
    </div>
  );
}
