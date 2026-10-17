"use client";

import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { AnswerOption, AnswerOptionGroup } from "../../_components/answer-option";
import { ItemLine } from "../../questions/item-text";
import { useFocusCheckWhenComplete } from "./question-actions";

/** Each step's place once graded: the learner's place was its right one, or not. */
export type OrderResult = { correctOrder: readonly number[]; order: readonly number[] };

function stepResult({ index, result }: { index: number; result: OrderResult | null }) {
  if (!result) {
    return null;
  }

  return result.order.indexOf(index) === result.correctOrder.indexOf(index) ? "right" : "wrong";
}

/** The place a step got, on its right: a filled number once placed, and whether it was right. */
function PlaceTag({ place, result }: { place: number; result: "right" | "wrong" | null }) {
  const t = useExtracted();

  return (
    <span className="flex items-center">
      <span
        aria-hidden="true"
        className="bg-foreground text-background flex size-6 items-center justify-center rounded-full font-mono text-xs font-medium tabular-nums"
      >
        {place + 1}
      </span>
      {result && (
        <span className="sr-only">{result === "right" ? t("Right place") : t("Wrong place")}</span>
      )}
    </span>
  );
}

/**
 * An ordering question: tap the steps in the order they go, and each one shows its place on its
 * right. Tapping a placed step takes it out. Number keys tap the steps as shown. The host gets the
 * order once every step has its place (null before), and its Check sends it. Once graded, each
 * step's ring says whether its place was right.
 */
export function OrderQuestion({
  disabled,
  onChange,
  result,
  steps,
}: {
  disabled: boolean;
  onChange: (answer: { order: number[] } | null) => void;
  result: OrderResult | null;
  steps: readonly string[];
}) {
  const t = useExtracted();
  const [order, setOrder] = useState<number[]>([]);
  const groupRef = useRef<HTMLDivElement>(null);
  const locked = disabled || result !== null;
  const placed = result?.order ?? order;

  useFocusCheckWhenComplete({ complete: order.length === steps.length, containerRef: groupRef });

  const tap = (index: number) => {
    const next = order.includes(index) ? order.filter((step) => step !== index) : [...order, index];

    setOrder(next);
    onChange(next.length === steps.length ? { order: next } : null);
  };

  useNumberKeys({ count: steps.length, enabled: !locked, onPick: tap });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm font-medium">{t("Tap the steps in order.")}</p>

      <AnswerOptionGroup ref={groupRef} role="group">
        {steps.map((step, index) => {
          const place = placed.indexOf(index);
          const placeResult = stepResult({ index, result });

          return (
            <AnswerOption
              aria-checked={place !== -1}
              aria-keyshortcuts={String(index + 1)}
              disabled={locked}
              key={step}
              marker={index + 1}
              onClick={() => tap(index)}
              picked={place !== -1}
              result={placeResult}
              role="checkbox"
              tag={place === -1 ? null : <PlaceTag place={place} result={placeResult} />}
            >
              <ItemLine text={step} />
            </AnswerOption>
          );
        })}
      </AnswerOptionGroup>
    </div>
  );
}
