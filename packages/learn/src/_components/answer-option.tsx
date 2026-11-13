"use client";

import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ignoreHeldEnter } from "@zoonk/ui/hooks/keyboard";
import { cn, mergeRefs } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useRef } from "react";
import { SpokenMath } from "../rich-text/spoken-math";
import {
  ANSWER_OPTION_CLASS,
  ANSWER_TAG_CLASS,
  ANSWER_TAG_TONE,
  ANSWER_TONE,
  type AnswerOptionResult,
} from "./answer-tone";

const RADIO_SELECTOR = "[role='radio']:not(:disabled)";

function getRadios(group: HTMLElement): HTMLElement[] {
  return [...group.querySelectorAll<HTMLElement>(RADIO_SELECTOR)];
}

/**
 * "Pick one" options take one Tab stop, the picked option or else the first, and ↑ and ↓ move
 * between them and pick, as `RadioGroup` and a native radio group do. `arrows="move"` only moves,
 * for a group where a pick is final at once. A `role="group"` of checkboxes keeps a stop each.
 */
export function AnswerOptionGroup({
  arrows = "pick",
  className,
  onKeyDown,
  ref,
  role = "radiogroup",
  ...props
}: React.ComponentProps<"div"> & { arrows?: "move" | "pick" }) {
  const t = useExtracted();
  const group = useRef<HTMLDivElement>(null);
  const single = role === "radiogroup";

  useLayoutEffect(() => {
    if (!group.current || !single) {
      return;
    }

    const radios = getRadios(group.current);
    const stop = radios.find((radio) => radio.ariaChecked === "true") ?? radios[0];

    for (const radio of radios) {
      radio.tabIndex = radio === stop ? 0 : -1;
    }
  });

  const moveWithArrows = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);

    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

    if (!single || !step || modified || event.defaultPrevented) {
      return;
    }

    const radios = getRadios(event.currentTarget);
    const active = document.activeElement;
    const index = active instanceof HTMLElement ? radios.indexOf(active) : -1;
    const next = radios[(index + step + radios.length) % radios.length];

    if (index === -1 || !next) {
      return;
    }

    event.preventDefault();
    next.focus();

    if (arrows === "pick" && !event.repeat) {
      next.click();
    }
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Its role is `radiogroup` unless the caller names another.
    <div
      aria-label={t("Answer options")}
      className={cn("flex flex-col gap-2", className)}
      data-slot="answer-option-group"
      onKeyDown={moveWithArrows}
      ref={mergeRefs(group, ref)}
      role={role}
      {...props}
    />
  );
}

/** A right pick says whose it is, so it isn't called correct twice under its verdict. */
function ResultTag({
  guessed,
  picked,
  result,
}: {
  guessed: boolean;
  picked: boolean;
  result: AnswerOptionResult;
}) {
  const t = useExtracted();

  const yourGuess = t({
    description: "Tags the learner's pick when it counts as neither right nor wrong.",
    message: "Your guess",
  });

  const yourPick = guessed ? yourGuess : t("Your answer");

  const labels: Record<AnswerOptionResult, string> = {
    guess: yourGuess,
    right: picked ? yourPick : t("Correct"),
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
  guessed = false,
  layout = "row",
  marker,
  onKeyDown,
  picked,
  result = null,
  tag,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & {
  guessed?: boolean;
  layout?: "row" | "stacked";
  marker: React.ReactNode;
  picked: boolean;
  result?: AnswerOptionResult | null;
  /** Replaces the result's word; `null` shows none. */
  tag?: React.ReactNode;
}) {
  // A submit option sends its form on the tap, so it's a plain button: nothing stays picked.
  const picks = type !== "submit";

  const shownTag =
    tag === undefined && result ? (
      <ResultTag guessed={guessed} picked={picked} result={result} />
    ) : (
      tag
    );

  return (
    <button
      aria-checked={picks ? picked : undefined}
      className={cn(
        ANSWER_OPTION_CLASS,
        "focus-visible:outline-ring enabled:hover:bg-muted/60 press outline-none select-none [--press-scale:0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid disabled:cursor-default",
        ANSWER_TONE.idle,
        layout === "row" && "flex-wrap",
        layout === "stacked" && "flex-col items-stretch p-2",
        picked && !result && cn(ANSWER_TONE.picked, "enabled:hover:bg-selected-tint"),
        result === "guess" && ANSWER_TONE.guess,
        result === "right" && cn(ANSWER_TONE.right, "enabled:hover:bg-success/9"),
        result === "wrong" && cn(ANSWER_TONE.wrong, "enabled:hover:bg-destructive/9"),
        className,
      )}
      data-result={result ?? undefined}
      data-slot="answer-option"
      onKeyDown={(event) => {
        ignoreHeldEnter(event);
        onKeyDown?.(event);
      }}
      role={picks ? "radio" : undefined}
      type={picks ? "button" : "submit"}
      {...props}
    >
      <LineMarker
        aria-hidden="true"
        className={cn(layout === "stacked" && "absolute top-3 left-3 z-10")}
      >
        <Kbd className="[&_svg]:size-3">{marker}</Kbd>
      </LineMarker>

      <TagBesideOrUnder layout={layout} tag={shownTag}>
        <SpokenMath>{children}</SpokenMath>
      </TagBesideOrUnder>
    </button>
  );
}

/**
 * The tag moves under the answer rather than leave it less than half the row or narrower than its
 * longest word.
 */
export function TagBesideOrUnder({
  children,
  layout = "row",
  tag,
}: {
  children: React.ReactNode;
  layout?: "row" | "stacked";
  tag: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex w-full grow basis-1/2 flex-wrap items-start justify-between gap-x-3 gap-y-1",
        layout === "stacked" && "contents",
      )}
    >
      <span
        className={cn(
          "flex flex-col",
          layout === "stacked" ? "min-w-0 flex-1" : "w-full max-w-max grow basis-1/2",
        )}
      >
        {children}
      </span>

      {tag && <LineMarker className="h-auto min-h-lh min-w-0 flex-initial">{tag}</LineMarker>}
    </span>
  );
}
