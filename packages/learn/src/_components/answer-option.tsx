"use client";

import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ANSWER_OPTION_CLASS,
  ANSWER_TAG_CLASS,
  ANSWER_TAG_TONE,
  ANSWER_TONE,
  type AnswerOptionResult,
} from "./answer-tone";

export function AnswerOptionGroup({ className, ...props }: React.ComponentProps<"div">) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("Answer options")}
      className={cn("flex flex-col gap-2.5", className)}
      data-slot="answer-option-group"
      role="radiogroup"
      {...props}
    />
  );
}

/** A right pick says "Your answer", so it isn't called correct twice under its verdict. */
function ResultTag({ picked, result }: { picked: boolean; result: AnswerOptionResult }) {
  const t = useExtracted();

  const labels: Record<AnswerOptionResult, string> = {
    guess: t("Your guess"),
    right: picked ? t("Your answer") : t("Correct"),
    wrong: t("Your answer"),
  };

  return (
    <span className={cn(ANSWER_TAG_CLASS, ANSWER_TAG_TONE[result])} data-slot="answer-option-tag">
      {labels[result]}
    </span>
  );
}

export function AnswerOption({
  children,
  className,
  layout = "row",
  marker,
  picked,
  result = null,
  tag,
  ...props
}: React.ComponentProps<"button"> & {
  layout?: "row" | "stacked";
  marker: React.ReactNode;
  picked: boolean;
  result?: AnswerOptionResult | null;
  /** Replaces the result's word; `null` shows none. */
  tag?: React.ReactNode;
}) {
  const shownTag =
    tag === undefined && result ? <ResultTag picked={picked} result={result} /> : tag;

  return (
    <button
      aria-checked={picked}
      className={cn(
        ANSWER_OPTION_CLASS,
        "focus-visible:outline-ring enabled:hover:bg-muted/60 press outline-none [--press-scale:0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid disabled:cursor-default",
        ANSWER_TONE.idle,
        layout === "stacked" && "flex-col items-stretch p-2",
        picked && !result && cn(ANSWER_TONE.picked, "enabled:hover:bg-selected-tint"),
        result === "guess" && ANSWER_TONE.guess,
        result === "right" && cn(ANSWER_TONE.right, "enabled:hover:bg-success/9"),
        result === "wrong" && cn(ANSWER_TONE.wrong, "enabled:hover:bg-destructive/9"),
        className,
      )}
      data-result={result ?? undefined}
      data-slot="answer-option"
      role="radio"
      type="button"
      {...props}
    >
      <LineMarker
        aria-hidden="true"
        className={cn(layout === "stacked" && "absolute top-3 left-3 z-10")}
      >
        <Kbd className="[&_svg]:size-3">{marker}</Kbd>
      </LineMarker>

      <span className="flex min-w-0 flex-1 flex-col">{children}</span>

      {shownTag && <LineMarker>{shownTag}</LineMarker>}
    </button>
  );
}
