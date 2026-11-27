"use client";

import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ignoreHeldEnter } from "@zoonk/ui/hooks/keyboard";
import { pickKey, shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { ANSWER_BOX_CLASS, ANSWER_HELD_TONE, ANSWER_TONE } from "./answer-tone";
import { DoneMark } from "./status-mark";

/**
 * `matched` is a pair the learner made that nothing has checked yet. On a board that checks each
 * try, `right` is a pair that just locked and `done` the same pair once it settles out of the way;
 * `wrong` is a try that didn't go together, shown for a moment. In the solved rows a pair is `right`,
 * or `missed` when its left card had a wrong try first: quiet, since the pair it shows is right.
 */
export type MatchEntryState =
  | "done"
  | "idle"
  | "matched"
  | "missed"
  | "right"
  | "selected"
  | "wrong";

/** Out of the way: the rest border on the page's ground, so it never looks like the pick's fill. */
const QUIET_TONE = cn(ANSWER_TONE.idle, "text-muted-foreground");

const ENTRY_TONE: Record<MatchEntryState, string> = {
  done: QUIET_TONE,
  idle: cn(ANSWER_TONE.idle, "enabled:hover:bg-muted/60"),
  matched: cn(ANSWER_TONE.idle, "enabled:hover:bg-muted/60"),
  missed: QUIET_TONE,
  right: ANSWER_TONE.right,
  selected: cn(ANSWER_TONE.picked, "enabled:hover:bg-selected-tint"),
  wrong: cn(ANSWER_TONE.wrong, "motion-safe:animate-shake"),
};

const SETTLED: ReadonlySet<MatchEntryState> = new Set(["done", "missed", "right"]);

/** A pick's mark in ink, as a radio's dot; where a keyboard picks the card, its key turns ink instead. */
function PickMark({ keyLabel }: { keyLabel: string | null }) {
  return (
    <>
      {keyLabel && (
        <Kbd className="bg-selected text-selected-foreground hidden ring-0 pointer-fine:inline-flex">
          {keyLabel}
        </Kbd>
      )}
      <span
        className={cn("bg-selected size-2.5 rounded-full", keyLabel && "pointer-fine:hidden")}
        data-slot="match-pick-mark"
      />
    </>
  );
}

/** The number both cards of a pair show, the left card's place: round, so it's never read as a key. */
function PairNumber({ muted, pair }: { muted: boolean; pair: number }) {
  return (
    <span
      className={cn(
        "text-background text-2xs flex size-5 items-center justify-center rounded-full font-mono font-medium tabular-nums",
        muted ? "bg-muted-foreground" : "bg-foreground",
      )}
      data-slot="match-pair-number"
    >
      {pair + 1}
    </span>
  );
}

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

  if (state === "missed") {
    return <DoneMark className="text-muted-foreground" />;
  }

  if (state === "wrong") {
    return <XIcon aria-hidden="true" className="text-destructive size-4" />;
  }

  if ((state === "matched" || state === "done") && pair !== undefined) {
    return <PairNumber muted={state === "done"} pair={pair} />;
  }

  const key = keyed ? pickKey(index) : null;

  if (state === "selected") {
    return <PickMark keyLabel={key ?? null} />;
  }

  if (!key) {
    return null;
  }

  return <Kbd className="hidden pointer-fine:inline-flex">{key}</Kbd>;
}

/**
 * One side of a pair on every screen that asks to match these with those. Its text starts at the
 * card's top edge; its mark (the key that picks it where there's a keyboard, the pick's dot, then a
 * check, a ✕ or the pair's number) sits level with its first line at the end, in room every state
 * keeps, so pairing moves no text. `index` is its place on the board, the left column first and
 * then the right, so no two entries show the same number key; `pair` is the place of its pair's
 * left entry, the number both of them show while the pair is unchecked or once it settles. An entry
 * answers its key only while it shows it. `label` is what a screen reader hears when that isn't the
 * text drawn, such as "pregnant, matched with grávida".
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
  const settled = SETTLED.has(state);
  const locked = disabled || settled;
  const keyed = !locked && state !== "matched";

  return (
    <button
      aria-keyshortcuts={keyed ? shortcutKeys("pick", index) : undefined}
      aria-pressed={settled ? undefined : state === "selected"}
      className={cn(
        ANSWER_BOX_CLASS,
        "h-full px-3",
        "focus-visible:outline-ring/50 press outline-none select-none [--press-scale:0.99] focus-visible:outline-3 focus-visible:outline-solid disabled:cursor-default",
        ENTRY_TONE[state],
        ANSWER_HELD_TONE,
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
