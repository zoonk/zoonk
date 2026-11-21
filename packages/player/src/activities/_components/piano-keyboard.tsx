"use client";

import { SidewaysScroll } from "@zoonk/ui/components/sideways-scroll";
import { cn } from "@zoonk/ui/lib/utils";
import { isBlackKey } from "../_utils/music-notes";
import { useRovingFocus } from "../_utils/use-roving-focus";
import { NoteMark, type NoteMarkKind } from "./note-mark";

const OCTAVE = 12;
const PERCENT = 100;
const BLACK_KEY_SHARE = 0.62;
// A key keeps room for its note's mark, which grows with the text size.
const NARROWEST_WHITE_KEY_REM = 2.25;
// A note's mark, ring included, fits inside its key, and an unmarked key's letter sits where its mark would.
const MARK_BOX_CLASS = "size-[min(--spacing(7),calc(100cqw-4px))]";

type PianoKey = { isBlack: boolean; midi: number; whiteIndex: number };

function layoutKeys(from: number, to: number): { keys: PianoKey[]; whiteCount: number } {
  const midis = Array.from({ length: to - from + 1 }, (_, index) => from + index);

  const keys = midis.map((midi) => ({
    isBlack: isBlackKey(midi),
    midi,
    whiteIndex: midis.filter((other) => other < midi && !isBlackKey(other)).length,
  }));

  return { keys, whiteCount: keys.filter((key) => !key.isBlack).length };
}

type KeyboardProps = {
  className?: string;
  disabled?: boolean;
  from: number;
  label: string;
  marks: ReadonlyMap<number, NoteMarkKind>;
  nameOf: (midi: number) => string;
  onPress?: (midi: number) => void;
  pressed?: (midi: number) => boolean;
  spokenNameOf: (midi: number) => string;
  to: number;
};

function keyPosition(key: PianoKey, whiteCount: number): React.CSSProperties {
  const whiteWidth = PERCENT / whiteCount;

  if (!key.isBlack) {
    return {};
  }

  const width = whiteWidth * BLACK_KEY_SHARE;
  return { left: `${key.whiteIndex * whiteWidth - width / 2}%`, width: `${width}%` };
}

export function PianoKeyboard({
  className,
  disabled,
  from,
  label,
  marks,
  nameOf,
  onPress,
  pressed,
  spokenNameOf,
  to,
}: KeyboardProps) {
  const { keys, whiteCount } = layoutKeys(from, to);
  const rovingProps = useRovingFocus(keys.length);
  const isInteractive = Boolean(onPress);

  // The octave fits the card on every phone at the usual text size; only larger text makes it scroll, the same in every state, so Check moves no key.
  return (
    <SidewaysScroll className={className} label={isInteractive ? label : undefined}>
      <div
        aria-hidden={isInteractive ? undefined : true}
        className="relative flex h-36 w-full touch-manipulation select-none"
        data-slot="piano-keyboard"
        style={{ minWidth: `${whiteCount * NARROWEST_WHITE_KEY_REM}rem` }}
      >
        {keys.map((key, index) => {
          const mark = marks.get(key.midi);
          const Element = isInteractive ? "button" : "span";

          return (
            <Element
              key={key.midi}
              {...(isInteractive && {
                ...rovingProps(index),
                "aria-label": spokenNameOf(key.midi),
                "aria-pressed": pressed?.(key.midi) ?? mark !== undefined,
                disabled,
                onClick: () => onPress?.(key.midi),
                type: "button" as const,
              })}
              className={cn(
                "@container flex items-end justify-center pb-2 outline-none",
                "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-inset",
                isInteractive && !disabled && "cursor-pointer",
                key.isBlack
                  ? "absolute top-0 z-10 h-[60%] rounded-b-lg bg-neutral-900 pb-1.5 dark:bg-neutral-950 dark:ring-1 dark:ring-neutral-600"
                  : "relative h-full flex-1 rounded-b-xl border-y border-e border-neutral-300 bg-white first:rounded-tl-lg first:border-s last:rounded-tr-lg dark:border-neutral-500 dark:bg-neutral-200",
                isInteractive &&
                  !key.isBlack &&
                  "active:bg-neutral-100 motion-safe:transition-colors",
                isInteractive &&
                  key.isBlack &&
                  "hit-area active:bg-neutral-700 motion-safe:transition-colors",
              )}
              data-slot="piano-key"
              style={keyPosition(key, whiteCount)}
            >
              {/* Keys keep their shade in dark mode, so a ring in the page's color sets a mark off a key of its shade. */}
              {mark && (
                <NoteMark
                  className={cn("ring-background ring-2", MARK_BOX_CLASS)}
                  kind={mark}
                  label={nameOf(key.midi)}
                />
              )}
              {!mark && key.midi % OCTAVE === 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex items-center justify-center text-xs font-medium text-neutral-600",
                    MARK_BOX_CLASS,
                  )}
                >
                  {nameOf(key.midi)}
                </span>
              )}
            </Element>
          );
        })}
      </div>
    </SidewaysScroll>
  );
}
