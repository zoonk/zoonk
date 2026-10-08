"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useKeyboardCallback, useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ItemLine } from "../../questions/item-text";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import { type StudyQuestionAnswer } from "../session-types";

/** How far a card moves before letting go answers it. */
const SWIPE_THRESHOLD_PX = 90;
const TILT_DEGREES_PER_PX = 0.06;
const LEFT_ARROW = "←";
const RIGHT_ARROW = "→";
const DOWN_ARROW = "↓";

const FALSE_ANSWER: StudyQuestionAnswer = { isTrue: false };
const TRUE_ANSWER: StudyQuestionAnswer = { isTrue: true };
const BLANK_ANSWER: StudyQuestionAnswer = { dontKnow: true };

const SCREEN_KEY = { mode: "none", screen: true } as const;

/**
 * The arrows swipe the card (← false, → true, ↓ blank), and number keys answer in the order the
 * buttons read, as they do on every other question.
 */
function useAnswerKeys({
  allowBlank,
  enabled,
  onAnswer,
}: {
  allowBlank: boolean;
  enabled: boolean;
  onAnswer: (answer: StudyQuestionAnswer) => void;
}) {
  const answers = allowBlank
    ? [FALSE_ANSWER, BLANK_ANSWER, TRUE_ANSWER]
    : [FALSE_ANSWER, TRUE_ANSWER];

  function answerWith(answer: StudyQuestionAnswer) {
    return () => (enabled ? onAnswer(answer) : false);
  }

  useKeyboardCallback("ArrowLeft", answerWith(FALSE_ANSWER), SCREEN_KEY);
  useKeyboardCallback("ArrowRight", answerWith(TRUE_ANSWER), SCREEN_KEY);
  useKeyboardCallback("ArrowDown", allowBlank ? answerWith(BLANK_ANSWER) : () => false, SCREEN_KEY);

  useNumberKeys({
    count: answers.length,
    enabled,
    onPick: (index) => {
      const answer = answers[index];

      if (answer) {
        onAnswer(answer);
      }
    },
  });
}

/** Drag the statement left for false or right for true; the buttons do the same. */
function useSwipe({
  enabled,
  onAnswer,
}: {
  enabled: boolean;
  onAnswer: (isTrue: boolean) => void;
}) {
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
          onAnswer(offset > 0);
        }
      },
    },
    offset,
  };
}

/**
 * A true-or-false statement, answered in the goal's exam's words (Cebraspe's are right or wrong).
 * Rapid-fire capsules answer it with two buttons; swipe capsules and practice for net-scored exams
 * add "Leave blank", since a wrong answer cancels a right one.
 */
export function TrueFalseQuestion({
  allowBlank,
  disabled,
  onAnswer,
  statement,
  trueFalseLabels,
}: {
  allowBlank: boolean;
  disabled: boolean;
  onAnswer: (answer: StudyQuestionAnswer) => void;
  statement: string;
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const { answerLabel } = useTrueFalseLabels(trueFalseLabels);
  const swipe = useSwipe({ enabled: !disabled, onAnswer: (isTrue) => onAnswer({ isTrue }) });

  useAnswerKeys({ allowBlank, enabled: !disabled, onAnswer });

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className={cn(
          "bg-background flex min-h-48 w-full touch-pan-y items-center justify-center rounded-3xl border p-6 text-center shadow-sm select-none",
          "motion-safe:transition-transform",
          !disabled && "cursor-grab active:cursor-grabbing",
        )}
        style={{
          transform: swipe.offset
            ? `translateX(${swipe.offset}px) rotate(${swipe.offset * TILT_DEGREES_PER_PX}deg)`
            : undefined,
        }}
        {...swipe.handlers}
      >
        <p className="text-xl leading-snug font-semibold text-balance">
          <ItemLine text={statement} />
        </p>
      </div>

      {/* On phones False and True share a row and "Leave blank" goes under them, so the three fit
          in every language; wider screens keep one row, blank in the middle. */}
      <div className="grid w-full grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Button
          aria-keyshortcuts="ArrowLeft 1"
          className="h-12 rounded-full"
          disabled={disabled}
          onClick={() => onAnswer({ isTrue: false })}
          size="lg"
          variant="outline"
        >
          <XIcon aria-hidden="true" />
          {answerLabel(false)}
          <ShortcutKbd>{LEFT_ARROW}</ShortcutKbd>
        </Button>

        {allowBlank ? (
          <Button
            aria-keyshortcuts="ArrowDown 2"
            className="col-span-2 row-start-2 h-12 rounded-full sm:col-span-1 sm:row-start-auto"
            disabled={disabled}
            onClick={() => onAnswer({ dontKnow: true })}
            size="lg"
            variant="ghost"
          >
            <MinusIcon aria-hidden="true" />
            {t("Leave blank")}
            <ShortcutKbd>{DOWN_ARROW}</ShortcutKbd>
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}

        <Button
          aria-keyshortcuts={allowBlank ? "ArrowRight 3" : "ArrowRight 2"}
          className="h-12 rounded-full"
          disabled={disabled}
          onClick={() => onAnswer({ isTrue: true })}
          size="lg"
          variant="outline"
        >
          <CheckIcon aria-hidden="true" />
          {answerLabel(true)}
          <ShortcutKbd>{RIGHT_ARROW}</ShortcutKbd>
        </Button>
      </div>
    </div>
  );
}
