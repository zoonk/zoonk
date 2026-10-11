"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useEnterKey, useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { EnterButton } from "../../_components/enter-button";
import { ItemLine } from "../../questions/item-text";
import { type StudyQuestionAnswer } from "../session-types";

/** Each step's place once graded: the learner's place was its right one, or not. */
export type OrderResult = { correctOrder: readonly number[]; order: readonly number[] };

function PlaceBadge({ place }: { place: number }) {
  return (
    <LineMarker aria-hidden="true">
      <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums">
        {place}
      </span>
    </LineMarker>
  );
}

function stepState({ index, result }: { index: number; result: OrderResult | null }) {
  if (!result) {
    return "idle";
  }

  return result.order.indexOf(index) === result.correctOrder.indexOf(index) ? "correct" : "wrong";
}

/**
 * An ordering question: tap the steps in the order they go, and each one shows its place. Tapping
 * a placed step takes it out. Number keys tap the steps as shown, and Check (or Enter) sends the
 * order once every step has its place. Once graded, each step shows whether its place was right.
 */
export function OrderQuestion({
  disabled,
  onAnswer,
  result,
  steps,
}: {
  disabled: boolean;
  onAnswer: (answer: StudyQuestionAnswer) => void;
  result: OrderResult | null;
  steps: string[];
}) {
  const t = useExtracted();
  const [order, setOrder] = useState<number[]>([]);
  const locked = disabled || result !== null;
  const complete = order.length === steps.length;
  const placed = result?.order ?? order;
  const check = () => onAnswer({ order });

  const tap = (index: number) => {
    setOrder(order.includes(index) ? order.filter((step) => step !== index) : [...order, index]);
  };

  useNumberKeys({ count: steps.length, enabled: !locked, onPick: tap });
  useEnterKey(check, { enabled: !locked && complete });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm font-medium">{t("Tap the steps in order.")}</p>

      <ul className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const place = placed.indexOf(index);
          const state = stepState({ index, result });

          return (
            <li key={step}>
              <button
                aria-keyshortcuts={String(index + 1)}
                aria-pressed={place !== -1}
                className={cn(
                  "focus-visible:ring-ring bg-background flex min-h-14 w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left font-medium transition-colors outline-none focus-visible:ring-2 disabled:cursor-default",
                  "hover:bg-muted/60 aria-pressed:border-foreground",
                  state === "correct" && "border-success bg-success/10 aria-pressed:border-success",
                  state === "wrong" &&
                    "border-destructive bg-destructive/10 aria-pressed:border-destructive",
                )}
                disabled={locked}
                onClick={() => tap(index)}
                type="button"
              >
                {place === -1 ? (
                  <LineMarker aria-hidden="true">
                    <span className="border-border size-6 rounded-full border border-dashed" />
                  </LineMarker>
                ) : (
                  <PlaceBadge place={place + 1} />
                )}
                <span className="flex-1">
                  <ItemLine text={step} />
                </span>
                {state !== "idle" && (
                  <LineMarker>
                    {state === "correct" ? (
                      <CheckIcon aria-label={t("Right place")} className="size-4" />
                    ) : (
                      <XIcon aria-label={t("Wrong place")} className="size-4" />
                    )}
                  </LineMarker>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {result === null && (
        <EnterButton disabled={disabled || !complete} onClick={check} type="button">
          {t("Check")}
        </EnterButton>
      )}
    </div>
  );
}
