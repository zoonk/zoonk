"use client";

import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { useRef, useState } from "react";
import { AnswerOption, AnswerOptionGroup } from "../../_components/answer-option";
import { ItemLine } from "../../questions/item-text";
import {
  type OptionSelect,
  PickRule,
  isCompletePick,
  isMultiPick,
  togglePick,
} from "../../questions/pick-rule";
import { useFocusCheckWhenComplete } from "./question-actions";

export type ChoiceResult = { correct: readonly number[]; picked: readonly number[] };

type ChoicePick = { selectedIndex: number } | { selectedIndexes: number[] };

function getOptionResult({ index, result }: { index: number; result: ChoiceResult | null }) {
  if (!result) {
    return null;
  }

  if (result.correct.includes(index)) {
    return "right";
  }

  return result.picked.includes(index) ? "wrong" : null;
}

function isShown({ index, result }: { index: number; result: ChoiceResult | null }) {
  if (!result || result.correct.length === 0) {
    return true;
  }

  return result.correct.includes(index) || result.picked.includes(index);
}

/** The host gets the answer once it's complete, null before. */
export function ChoiceQuestion({
  disabled,
  onChange,
  options,
  result,
  select,
}: {
  disabled: boolean;
  onChange: (answer: ChoicePick | null) => void;
  options: readonly string[];
  result: ChoiceResult | null;
  select: OptionSelect | null;
}) {
  const [picks, setPicks] = useState<number[]>([]);
  const groupRef = useRef<HTMLDivElement>(null);
  const locked = disabled || result !== null;
  const multi = isMultiPick(select);
  const shownPicks = result?.picked ?? picks;

  useFocusCheckWhenComplete({
    complete: multi && isCompletePick({ picks, select }),
    containerRef: groupRef,
  });

  const pick = (index: number) => {
    if (multi) {
      const next = togglePick(picks, index);
      setPicks(next);
      onChange(isCompletePick({ picks: next, select }) ? { selectedIndexes: next } : null);
      return;
    }

    const cleared = picks[0] === index;
    setPicks(cleared ? [] : [index]);
    onChange(cleared ? null : { selectedIndex: index });
  };

  useNumberKeys({ count: options.length, enabled: !locked, onPick: pick });

  return (
    <div className="flex flex-col gap-3">
      {multi && <PickRule select={select} />}

      <AnswerOptionGroup ref={groupRef} role={multi ? "group" : "radiogroup"}>
        {options.map((option, index) =>
          isShown({ index, result }) ? (
            <AnswerOption
              aria-keyshortcuts={String(index + 1)}
              disabled={locked}
              key={option}
              marker={index + 1}
              onClick={() => pick(index)}
              picked={shownPicks.includes(index)}
              result={getOptionResult({ index, result })}
              role={multi ? "checkbox" : "radio"}
            >
              <ItemLine text={option} />
            </AnswerOption>
          ) : null,
        )}
      </AnswerOptionGroup>
    </div>
  );
}
