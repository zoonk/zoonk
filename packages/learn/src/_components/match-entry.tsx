"use client";

import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ignoreHeldEnter } from "@zoonk/ui/hooks/keyboard";
import { pickKey, shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { ANSWER_BOX_CLASS, ANSWER_TONE } from "./answer-tone";

/**
 * `matched` is a pair the learner made that nothing has checked yet; `right` is a pair checked and
 * kept; `wrong` is a try that didn't go together; `none` is an entry shown to have no pair.
 */
export type MatchEntryState = "idle" | "matched" | "none" | "right" | "selected" | "wrong";

const ENTRY_TONE: Record<MatchEntryState, string> = {
  idle: cn(ANSWER_TONE.idle, "enabled:hover:bg-muted/60"),
  matched: cn(ANSWER_TONE.idle, "enabled:hover:bg-muted/60"),
  none: "text-muted-foreground outline-input outline-1 -outline-offset-1 outline-dashed",
  right: ANSWER_TONE.right,
  selected: cn(ANSWER_TONE.picked, "enabled:hover:bg-selected-tint"),
  wrong: cn(ANSWER_TONE.wrong, "motion-safe:animate-shake"),
};

const PAIRED = new Set<MatchEntryState>(["matched", "right"]);
const SETTLED = new Set<MatchEntryState>(["none", "right"]);

/**
 * The box at an entry's start shows the key that picks it. Once the entry is in a pair, the pair's
 * number fills the same box, so matching moves no text; an entry with no pair leaves it empty.
 */
function EntryMarker({
  index,
  pair,
  state,
}: {
  index: number;
  pair?: number;
  state: MatchEntryState;
}) {
  const paired = PAIRED.has(state) && pair !== undefined;
  const cap = paired ? pair + 1 : pickKey(index);

  return (
    <LineMarker aria-hidden="true" className="w-5">
      {state !== "none" && cap && (
        <Kbd className={cn(paired && "bg-foreground text-background ring-0")}>{cap}</Kbd>
      )}
    </LineMarker>
  );
}

/**
 * One side of a pair on every screen that asks to match these with those. `index` is its place on
 * the board, the left column first and then the right, so no two entries show the same number key;
 * `pair` is the place of its pair's left entry, whose key both of them then show. An entry answers
 * its key only while it shows it. `label` is what a screen reader hears when that isn't the text
 * drawn, such as "pregnant, matched". Its text takes the size of the board it sits in, which also
 * decides when the board's columns stack.
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
  const keyed = !locked && !PAIRED.has(state);

  return (
    <button
      aria-keyshortcuts={keyed ? shortcutKeys("pick", index) : undefined}
      aria-pressed={settled ? undefined : state === "selected"}
      className={cn(
        ANSWER_BOX_CLASS,
        "gap-2 px-3",
        "focus-visible:outline-ring press outline-none select-none [--press-scale:0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid disabled:cursor-default",
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
      <EntryMarker index={index} pair={pair} state={state} />
      <span aria-hidden={label !== undefined || undefined} className="min-w-0 flex-1">
        {children}
      </span>

      {label !== undefined && <span className="sr-only">{label}</span>}
    </button>
  );
}
