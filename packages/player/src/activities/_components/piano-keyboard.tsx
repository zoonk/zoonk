"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { isBlackKey } from "../_utils/music-notes";
import { useRovingFocus } from "../_utils/use-roving-focus";
import { NoteMark, type NoteMarkKind } from "./note-mark";

const OCTAVE = 12;
const PERCENT = 100;
const BLACK_KEY_SHARE = 0.62;

/**
 * A key people press is at least 44 px wide: white keys at 4.5rem (72 px) keep the black keys at
 * 62% of that above 44 px, so a keyboard wider than the screen scrolls sideways.
 */
const PRESSABLE_WHITE_KEY_REM = 4.5;

type PianoKey = { isBlack: boolean; midi: number; whiteIndex: number };

/** Keys from `from` to `to`; each black key sits over the line after the white keys before it. */
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
  /** Names the group of keys for screen readers, like "Piano keys". */
  label: string;
  marks: ReadonlyMap<number, NoteMarkKind>;
  /** The note name drawn on a marked key. */
  nameOf: (midi: number) => string;
  /** Pressing a key toggles it. Without it, the keyboard only shows notes. */
  onPress?: (midi: number) => void;
  /** Whether a key counts as pressed, for `aria-pressed`. */
  pressed?: (midi: number) => boolean;
  /** The note name read aloud, like "E flat". */
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

/**
 * A piano keyboard drawn to scale, for pressing notes or showing them. Pressing works with a
 * pointer or the keyboard: one tab stop, the arrows move between keys and Enter or Space presses
 * the focused key.
 */
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

  const keyboard = (
    <div
      aria-hidden={isInteractive ? undefined : true}
      aria-label={isInteractive ? label : undefined}
      className={cn(
        "relative flex h-36 w-full touch-manipulation select-none",
        !isInteractive && className,
      )}
      data-slot="piano-keyboard"
      role={isInteractive ? "group" : undefined}
      style={isInteractive ? { minWidth: `${whiteCount * PRESSABLE_WHITE_KEY_REM}rem` } : undefined}
    >
      {keys.map((key, index) => {
        const mark = marks.get(key.midi);
        const Element = isInteractive ? "button" : "span";

        return (
          <Element
            {...(isInteractive && {
              ...rovingProps(index),
              "aria-label": spokenNameOf(key.midi),
              "aria-pressed": pressed?.(key.midi) ?? mark !== undefined,
              disabled,
              onClick: () => onPress?.(key.midi),
              type: "button" as const,
            })}
            className={cn(
              "flex items-end justify-center pb-2 outline-none",
              "focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:ring-inset",
              isInteractive && !disabled && "cursor-pointer",
              key.isBlack
                ? "absolute top-0 z-10 h-[60%] rounded-b-lg bg-neutral-900 pb-1.5 dark:bg-neutral-950 dark:ring-1 dark:ring-neutral-600"
                : "relative h-full flex-1 rounded-b-xl border border-neutral-300 bg-white first:rounded-tl-lg last:rounded-tr-lg dark:border-neutral-500 dark:bg-neutral-200",
              isInteractive &&
                !key.isBlack &&
                "active:bg-neutral-100 motion-safe:transition-colors",
              isInteractive && key.isBlack && "active:bg-neutral-700 motion-safe:transition-colors",
            )}
            data-slot="piano-key"
            key={key.midi}
            style={keyPosition(key, whiteCount)}
          >
            {mark && <NoteMark kind={mark} label={nameOf(key.midi)} />}
            {!mark && key.midi % OCTAVE === 0 && (
              <span aria-hidden="true" className="text-xs font-medium text-neutral-600">
                {nameOf(key.midi)}
              </span>
            )}
          </Element>
        );
      })}
    </div>
  );

  return isInteractive ? (
    <div className={cn("w-full overflow-x-auto", className)} data-slot="piano-keyboard-scroll">
      {keyboard}
    </div>
  ) : (
    keyboard
  );
}
