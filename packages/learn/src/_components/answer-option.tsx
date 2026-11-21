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

function useResultLabels() {
  const t = useExtracted();

  return {
    correct: t("Correct"),
    yourAnswer: t("Your answer"),
    yourGuess: t({
      description: "Tags the learner's pick when it counts as neither right nor wrong.",
      message: "Your guess",
    }),
  };
}

/** A right pick says whose it is, so it isn't called correct twice under its verdict. */
export function ResultTag({
  guessed,
  picked,
  result,
}: {
  guessed: boolean;
  picked: boolean;
  result: AnswerOptionResult;
}) {
  const { correct, yourAnswer, yourGuess } = useResultLabels();
  const yourPick = guessed ? yourGuess : yourAnswer;

  const labels: Record<AnswerOptionResult, string> = {
    guess: yourGuess,
    right: picked ? yourPick : correct,
    wrong: yourAnswer,
  };

  return (
    <span className={cn(ANSWER_TAG_CLASS, ANSWER_TAG_TONE[result])} data-slot="answer-option-tag">
      {labels[result]}
    </span>
  );
}

/** Before Check, a pick says it's the learner's in the words its verdict keeps. Unspoken: the radio is checked. */
function PickedTag({ guessed }: { guessed: boolean }) {
  const { yourAnswer, yourGuess } = useResultLabels();

  return (
    <span
      aria-hidden="true"
      className={cn(ANSWER_TAG_CLASS, "text-foreground")}
      data-slot="answer-option-tag"
    >
      {guessed ? yourGuess : yourAnswer}
    </span>
  );
}

/**
 * Before Check, the room of the widest tag a verdict can bring, unseen and the same on every
 * option, so the tag fills it later and the answer's words never move. The labels are CSS content,
 * not text, so nothing reads or finds the unseen ones.
 */
function ReservedTag({ children }: { children: React.ReactNode }) {
  const labels = Object.entries(useResultLabels());

  return (
    <span className="grid min-w-0">
      {labels.map(([key, label]) => (
        <span
          aria-hidden="true"
          className={cn(
            ANSWER_TAG_CLASS,
            "invisible col-start-1 row-start-1 before:content-[attr(data-label)]",
          )}
          data-label={label}
          key={key}
        />
      ))}

      {children && (
        <span className={cn(ANSWER_TAG_CLASS, "col-start-1 row-start-1")}>{children}</span>
      )}
    </span>
  );
}

/**
 * A number is the row's key, so a touch screen gives up its room (craft E1, B2). A picked row's key
 * turns ink, the row's mark as a radio's dot is. Once checked or disabled the key does nothing, so
 * it hides in its room and the answer stays put.
 */
export function OptionMarker({
  isChecked,
  layout,
  marker,
  picked,
}: {
  isChecked: boolean;
  layout: "row" | "stacked";
  marker: React.ReactNode;
  picked: boolean;
}) {
  const isKey = typeof marker === "number";

  return (
    <LineMarker
      aria-hidden="true"
      className={cn(
        isKey && "hidden pointer-fine:flex",
        isKey && isChecked && "invisible",
        layout === "stacked" && "absolute top-3 left-3 z-10",
      )}
    >
      <Kbd
        className={cn("[&_svg]:size-3", picked && "bg-selected text-selected-foreground ring-0")}
      >
        {marker}
      </Kbd>
    </LineMarker>
  );
}

function defaultTag({
  guessed,
  picked,
  picks,
  result,
}: {
  guessed: boolean;
  picked: boolean;
  picks: boolean;
  result: AnswerOptionResult | null;
}): React.ReactNode {
  if (result) {
    return <ResultTag guessed={guessed} picked={picked} result={result} />;
  }

  return picked && picks ? <PickedTag guessed={guessed} /> : undefined;
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

  const shownTag = tag === undefined ? defaultTag({ guessed, picked, picks, result }) : tag;

  return (
    <button
      aria-checked={picks ? picked : undefined}
      className={cn(
        ANSWER_OPTION_CLASS,
        "focus-visible:outline-ring/50 enabled:hover:bg-muted/60 press outline-none select-none [--press-scale:0.99] focus-visible:outline-3 focus-visible:outline-solid disabled:cursor-default",
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
      <OptionMarker
        isChecked={Boolean(result) || Boolean(props.disabled)}
        layout={layout}
        marker={marker}
        picked={picked && !result}
      />

      <TagBesideOrUnder layout={layout} reservesTag={picks && tag === undefined} tag={shownTag}>
        <SpokenMath>{children}</SpokenMath>
      </TagBesideOrUnder>
    </button>
  );
}

/**
 * The answer is sized by its words, where a percentage can't cap a formula, so a row holding one is
 * a container and a formula wider than it scrolls inside it.
 */
const ROW_FORMULA_CLASS =
  "has-data-[slot=inline-math]:@container [&_[data-slot=inline-math]]:max-w-[100cqi]";

/**
 * Code keeps its shape, so its tag holds the card's end edge instead of following the words: on the
 * code's last line while that line leaves room, and otherwise on a line under it. Code never wraps
 * to make room.
 */
const ROW_CODE_CLASS =
  "has-data-[slot=code-snippet]:flex has-data-[slot=code-snippet]:flex-wrap has-data-[slot=code-snippet]:items-baseline-last has-data-[slot=code-snippet]:gap-x-3 [&_:has([data-slot=code-snippet-line])]:contents [&_[data-slot=code-snippet-line]]:basis-full [&_[data-slot=code-snippet-line]:last-child]:basis-auto";

const TAG_AFTER_CODE_CLASS =
  "[:has([data-slot=code-snippet])>&]:ms-auto [:has([data-slot=code-snippet])>&]:text-end";

/**
 * `reservesTag` holds room for the verdict from the start. The space before the inline tag
 * disappears at a line break, so the tag starts at the text edge if it needs its own line.
 */
export function TagBesideOrUnder({
  children,
  layout = "row",
  reservesTag = false,
  tag,
}: {
  children: React.ReactNode;
  layout?: "row" | "stacked";
  reservesTag?: boolean;
  tag: React.ReactNode;
}) {
  if (layout === "stacked") {
    return (
      <span className="contents">
        <span className="flex min-w-0 flex-1 flex-col">{children}</span>

        {/* Under a picture, the tag ends the card. */}
        {tag && (
          <LineMarker className="h-auto min-h-lh min-w-0 flex-initial justify-end px-1 pb-0.5">
            {tag}
          </LineMarker>
        )}
      </span>
    );
  }

  return (
    <span className={cn("block w-full grow basis-1/2", ROW_FORMULA_CLASS, ROW_CODE_CLASS)}>
      {children}

      {(tag || reservesTag) && (
        <span className="[word-spacing:0.5rem] [:has([data-slot=code-snippet])>&]:hidden"> </span>
      )}
      {(tag || reservesTag) && (
        <LineMarker
          className={cn("inline-flex h-auto min-h-lh max-w-full align-top", TAG_AFTER_CODE_CLASS)}
        >
          {reservesTag ? <ReservedTag>{tag}</ReservedTag> : tag}
        </LineMarker>
      )}
    </span>
  );
}
