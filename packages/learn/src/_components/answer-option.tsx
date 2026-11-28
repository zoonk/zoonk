"use client";

import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { SCREEN_ENTER, ignoreHeldEnter } from "@zoonk/ui/hooks/keyboard";
import { cn, mergeRefs } from "@zoonk/ui/lib/utils";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useRef } from "react";
import { SpokenMath } from "../rich-text/spoken-math";
import { PickMark, getPickMark } from "./answer-pick-mark";
import {
  ANSWER_HELD_TONE,
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

/**
 * The word an option shows. The right option says "Correct" when the learner missed it. A pick
 * needs no word of its own: its mark, its color and the verdict say it. Only a guess, which counts
 * as neither right nor wrong, says so once it's checked; before, its mark shows the pick.
 */
export function useAnswerTag({
  guessed,
  picked,
  result,
}: {
  guessed: boolean;
  picked: boolean;
  result: AnswerOptionResult | null;
}): React.ReactNode {
  const t = useExtracted();

  if (result === "guess" || (result && picked && guessed)) {
    return (
      <AnswerTag className={ANSWER_TAG_TONE[result]}>
        {t({
          description: "Tags the learner's pick when it counts as neither right nor wrong.",
          message: "Your guess",
        })}
      </AnswerTag>
    );
  }

  if (result === "right" && !picked) {
    return <AnswerTag className={ANSWER_TAG_TONE.right}>{t("Correct")}</AnswerTag>;
  }

  return null;
}

function AnswerTag({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn(ANSWER_TAG_CLASS, className)} data-slot="answer-option-tag" {...props} />
  );
}

const RESULT_MARK: Record<AnswerOptionResult, React.ReactNode> = {
  guess: <MinusIcon />,
  right: <CheckIcon />,
  wrong: <XIcon />,
};

/**
 * A number is the row's key, so a touch screen gives up its room (craft E1, B2). On a row without a
 * pick mark, the picked row's key turns ink, as a radio's dot does. Once checked the key does
 * nothing, so its room shows the verdict's mark and the answer stays put; a locked row without one
 * hides its key.
 */
export function OptionMarker({
  isLocked = false,
  layout,
  marker,
  picked,
  result = null,
  showsPick = true,
}: {
  isLocked?: boolean;
  layout: "row" | "stacked";
  marker: React.ReactNode;
  picked: boolean;
  result?: AnswerOptionResult | null;
  showsPick?: boolean;
}) {
  const isKey = typeof marker === "number";

  return (
    <LineMarker
      aria-hidden="true"
      className={cn(
        isKey && "hidden pointer-fine:flex",
        isKey && isLocked && !result && "invisible",
        layout === "stacked" && "absolute top-3 left-3 z-10",
      )}
    >
      <Kbd
        className={cn(
          "[&_svg]:size-3",
          showsPick &&
            "in-data-held:bg-selected in-data-held:text-selected-foreground in-data-[held=unchecked]:bg-foreground/4! in-data-[held=unchecked]:text-muted-foreground! in-data-held:ring-0 in-data-[held=unchecked]:ring-1!",
          showsPick && picked && "bg-selected text-selected-foreground ring-0",
        )}
      >
        {isKey && result ? RESULT_MARK[result] : marker}
      </Kbd>
    </LineMarker>
  );
}

function answerToneClass({
  picked,
  result,
}: {
  picked: boolean;
  result: AnswerOptionResult | null;
}): string | undefined {
  if (result === "guess") {
    return ANSWER_TONE.guess;
  }

  if (result === "right") {
    return cn(ANSWER_TONE.right, "enabled:hover:bg-success/9");
  }

  if (result === "wrong") {
    return cn(ANSWER_TONE.wrong, "enabled:hover:bg-destructive/9");
  }

  return picked ? cn(ANSWER_TONE.picked, "enabled:hover:bg-selected-tint") : undefined;
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

  const answerTag = useAnswerTag({ guessed, picked, result });
  const shownTag = tag === undefined ? answerTag : tag;
  const mark = getPickMark({ hasAction: Boolean(props.onClick), picks, role: props.role });

  return (
    <button
      aria-checked={picks ? picked : undefined}
      className={cn(
        ANSWER_OPTION_CLASS,
        "focus-visible:outline-ring/50 enabled:hover:bg-muted/60 press outline-none select-none [--press-scale:0.99] focus-visible:outline-3 focus-visible:outline-solid disabled:cursor-default",
        ANSWER_TONE.idle,
        ANSWER_HELD_TONE,
        layout === "row" ? "flex-wrap" : "flex-col items-stretch p-2",
        answerToneClass({ picked, result }),
        className,
      )}
      data-result={result ?? undefined}
      data-slot="answer-option"
      onKeyDown={(event) => {
        ignoreHeldEnter(event);
        onKeyDown?.(event);
      }}
      role={picks ? "radio" : undefined}
      {...(mark === "check" ? SCREEN_ENTER : {})}
      // A press made before the page hydrates marks it held, drawn as picked.
      suppressHydrationWarning
      type={picks ? "button" : "submit"}
      {...props}
    >
      <OptionMarker
        isLocked={Boolean(props.disabled)}
        layout={layout}
        marker={marker}
        picked={picked && !result}
        result={result}
        showsPick={!mark}
      />

      <TagBesideOrUnder layout={layout} tag={shownTag}>
        <SpokenMath>{children}</SpokenMath>
      </TagBesideOrUnder>

      {mark && <PickMark kind={mark} layout={layout} picked={picked} />}
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
  "[:has([data-slot=code-snippet])>&]:ms-auto [:has([data-slot=code-snippet])>&]:min-h-0 [:has([data-slot=code-snippet])>&]:text-end";

/**
 * The tag follows the words inline, and a tag on its own line starts at the text edge because the
 * space before it disappears at the break. The words wrap line by line, so a tag arriving after
 * them never moves a word, as the page's pretty wrapping would.
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
    <span
      className={cn(
        "block w-full grow basis-1/2 [text-wrap-style:stable]",
        ROW_FORMULA_CLASS,
        ROW_CODE_CLASS,
      )}
    >
      {children}

      {tag && (
        <span className="[word-spacing:0.5rem] [:has([data-slot=code-snippet])>&]:hidden"> </span>
      )}
      {tag && (
        <LineMarker
          className={cn("inline-flex h-auto min-h-lh max-w-full align-top", TAG_AFTER_CODE_CLASS)}
        >
          {tag}
        </LineMarker>
      )}
    </span>
  );
}
