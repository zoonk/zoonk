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

/** The picks of a question, one under the other like an exam's answer sheet. */
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

/**
 * What a checked option says on its right: "Correct" on the right answer the learner didn't pick,
 * "Your answer" on their pick (blue when right, so a right answer isn't called correct twice
 * under its verdict), and "Your guess" on a guess.
 */
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

/**
 * One answer to pick, the same in a lesson, a session, a practice, a checkpoint and a mock: its
 * number key in a keycap on the left, its words, and a strong line around it. Picked, it gets the
 * learner's ring and tint in the text color; once checked, the right answer turns blue ("Correct",
 * or "Your answer" when it was the pick) and a wrong pick red ("Your answer"), while its words stay
 * readable in the text color; a guess's pick keeps a neutral ring ("Your guess"). `role="checkbox"`
 * where a question takes several picks; tapping a picked one again clears it.
 *
 * ```tsx
 * <AnswerOption marker={2} picked result="right">96%</AnswerOption>
 * ```
 */
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
  /** `stacked` puts a picture option's key over its picture, the words under it. */
  layout?: "row" | "stacked";
  marker: React.ReactNode;
  picked: boolean;
  result?: AnswerOptionResult | null;
  /** What the option says on its right instead of its result's word; `null` says nothing. */
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
      {/* On the answer's first line: the keycap is centered on one line of text. */}
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
