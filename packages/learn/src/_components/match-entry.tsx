"use client";

import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ignoreHeldEnter } from "@zoonk/ui/hooks/keyboard";
import { pickKey, shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { ANSWER_BOX_CLASS, ANSWER_TONE } from "./answer-tone";
import { DoneMark } from "./status-mark";

/**
 * `matched` is a pair the learner made that nothing has checked yet; `right` is a pair checked and
 * kept; `wrong` is a try that didn't go together, shown for a moment; `missed` is a pair the
 * learner got only after a wrong try, shown in the result.
 */
export type MatchEntryState = "idle" | "matched" | "missed" | "right" | "selected" | "wrong";

const ENTRY_TONE: Record<MatchEntryState, string> = {
  idle: cn(ANSWER_TONE.idle, "enabled:hover:bg-muted/60"),
  matched: cn(ANSWER_TONE.idle, "enabled:hover:bg-muted/60"),
  missed: ANSWER_TONE.wrong,
  right: ANSWER_TONE.right,
  selected: cn(ANSWER_TONE.picked, "enabled:hover:bg-selected-tint"),
  wrong: cn(ANSWER_TONE.wrong, "motion-safe:animate-shake"),
};

function EntryMark({
  index,
  keyed,
  pair,
  state,
}: {
  index: number;
  keyed: boolean;
  pair?: number;
  state: MatchEntryState;
}) {
  if (state === "right") {
    return <DoneMark />;
  }

  if (state === "wrong" || state === "missed") {
    return <XIcon aria-hidden="true" className="text-destructive size-4" />;
  }

  if (state === "matched" && pair !== undefined) {
    return (
      <span className="bg-foreground text-background text-2xs flex size-5 items-center justify-center rounded-full font-mono font-medium tabular-nums">
        {pair + 1}
      </span>
    );
  }

  const key = pickKey(index);

  if (!key || !keyed) {
    return null;
  }

  return (
    <Kbd
      className={cn(
        "hidden pointer-fine:inline-flex",
        state === "selected" && "bg-selected text-selected-foreground ring-0",
      )}
    >
      {key}
    </Kbd>
  );
}

/**
 * One side of a pair on every screen that asks to match these with those. Its text starts at the
 * card's edge; its mark (the key that picks it where there's a keyboard, then a check, a ✕ or the
 * pair's number) sits level with its first line at the end, in room every state keeps, so pairing
 * moves no text. `index` is its place on the board, the left column first and then the right, so no two
 * entries show the same number key; `pair` is the place of its pair's left entry, the number both
 * of them show while the pair is unchecked. An entry answers its key only while it shows it.
 * `label` is what a screen reader hears when that isn't the text drawn, such as "pregnant, matched
 * with grávida".
 */
export function MatchEntry({
  children,
  className,
  disabled,
  index,
  label,
  onKeyDown,
  pair,
  state = "idle",
  ...props
}: React.ComponentProps<"button"> & {
  index: number;
  label?: string;
  pair?: number;
  state?: MatchEntryState;
}) {
  const settled = state === "right" || state === "missed";
  const locked = disabled || settled;
  const keyed = !locked && state !== "matched";

  return (
    <button
      aria-keyshortcuts={keyed ? shortcutKeys("pick", index) : undefined}
      aria-pressed={settled ? undefined : state === "selected"}
      className={cn(
        ANSWER_BOX_CLASS,
        "h-full items-center px-3",
        "focus-visible:outline-ring/50 press outline-none select-none [--press-scale:0.99] focus-visible:outline-3 focus-visible:outline-solid disabled:cursor-default",
        ENTRY_TONE[state],
        className,
      )}
      data-slot="match-entry"
      data-state={state}
      disabled={locked}
      onKeyDown={(event) => {
        ignoreHeldEnter(event);
        onKeyDown?.(event);
      }}
      type="button"
      {...props}
    >
      <span
        aria-hidden={label !== undefined || undefined}
        className="flex min-w-0 flex-1 items-start gap-2"
      >
        <span className="min-w-0 flex-1" data-slot="match-entry-text">
          {children}
        </span>
        <LineMarker aria-hidden="true" className="w-5 justify-center">
          <EntryMark index={index} keyed={keyed} pair={pair} state={state} />
        </LineMarker>
      </span>

      {label !== undefined && <span className="sr-only">{label}</span>}
    </button>
  );
}
