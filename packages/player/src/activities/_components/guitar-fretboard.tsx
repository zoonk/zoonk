"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { GUITAR_TUNING, type GuitarVoicing, stringNoteMidi } from "../_utils/guitar-voicing";
import { keepArrowKeys } from "../_utils/keep-arrow-keys";
import { NoteMark, type NoteMarkKind } from "./note-mark";

/** How tab and chord charts mark a string that isn't played. */
const MUTED_MARK = "×";

/** Frets shown at once: one hand's reach plus one. */
export const FRETBOARD_SPAN = 4;

/** Strings are drawn the way tab reads them: the high E on top. */
const STRINGS_TOP_DOWN = GUITAR_TUNING.map((_, index) => index).toReversed();

type FretboardProps = {
  /** The first fret shown; 1 draws the nut. */
  firstFret: number;
  label: string;
  /** How each played string is drawn, by string (low E is 0). Defaults to `new`. */
  markOf?: (stringIndex: number) => NoteMarkKind;
  nameOf: (midi: number) => string;
  /** Picking a fret (or null to mute) for a string. Without it, the fretboard only shows. */
  onChange?: (stringIndex: number, fret: number | null) => void;
  /** Screen reader names: a string ("Low E string") and a position ("Fret 3", "Open"). */
  positionLabel: (fret: number | null, midi: number | null) => string;
  stringLabel: (stringIndex: number) => string;
  /** The short names on the left: E A D G B E. */
  stringNames: readonly string[];
  voicing: GuitarVoicing;
};

function frets(firstFret: number): number[] {
  return Array.from({ length: FRETBOARD_SPAN }, (_, index) => firstFret + index);
}

/** The string names, then muted and open (one column when only shown), then the frets. */
function gridColumns(isInput: boolean): React.CSSProperties {
  const before = isInput ? "2.75rem 2.75rem" : "2rem";

  return {
    gridTemplateColumns: `1.25rem ${before} repeat(${FRETBOARD_SPAN}, minmax(2.75rem, 1fr))`,
  };
}

function OpenOrMuted({ fret }: { fret: number | null | undefined }) {
  if (fret === null) {
    return <span className="text-muted-foreground text-sm font-semibold">{MUTED_MARK}</span>;
  }

  return fret === 0 ? <span className="border-foreground size-3.5 rounded-full border-2" /> : null;
}

/** One string as a row of radio buttons: muted, open or a fret, so any keyboard can pick. */
function StringPicker({
  firstFret,
  markOf,
  name,
  nameOf,
  onChange,
  positionLabel,
  stringIndex,
  stringLabel,
  voicing,
}: Omit<FretboardProps, "label" | "stringNames"> & {
  name: string;
  onChange: NonNullable<FretboardProps["onChange"]>;
  stringIndex: number;
}) {
  const current = voicing[stringIndex] ?? null;
  const options = [null, 0, ...frets(firstFret)];

  return (
    <div
      aria-label={stringLabel(stringIndex)}
      className="contents"
      onKeyDown={keepArrowKeys}
      role="radiogroup"
      tabIndex={-1}
    >
      {options.map((fret, column) => {
        const midi = fret === null ? null : stringNoteMidi(stringIndex, fret);
        const isChecked = current === fret;

        return (
          <label
            className={cn(
              "relative flex h-11 cursor-pointer items-center justify-center",
              column === 1 && firstFret === 1 && "border-foreground/70 border-r-4",
              column === 1 && firstFret > 1 && "border-border border-r-2",
              column > 1 && "border-border border-r-2",
              "has-focus-visible:ring-ring/60 has-focus-visible:rounded-md has-focus-visible:ring-[3px] has-focus-visible:ring-inset",
            )}
            key={fret ?? "muted"}
          >
            <input
              aria-label={positionLabel(fret, midi)}
              checked={isChecked}
              className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
              name={name}
              onChange={() => onChange(stringIndex, fret)}
              type="radio"
            />

            {column > 1 && (
              <span aria-hidden="true" className="bg-muted-foreground/50 absolute inset-x-0 h-px" />
            )}

            {isChecked && midi !== null && fret !== 0 && (
              <NoteMark
                className="relative"
                kind={markOf?.(stringIndex) ?? "new"}
                label={nameOf(midi)}
              />
            )}

            {column === 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  "text-sm font-semibold",
                  isChecked ? "text-foreground" : "text-muted-foreground/40",
                )}
              >
                {MUTED_MARK}
              </span>
            )}

            {column === 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "size-3.5 rounded-full border-2",
                  isChecked ? "border-foreground bg-foreground/10" : "border-muted-foreground/30",
                )}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

function StringRow({
  firstFret,
  markOf,
  nameOf,
  stringIndex,
  voicing,
}: Pick<FretboardProps, "firstFret" | "markOf" | "nameOf" | "voicing"> & { stringIndex: number }) {
  const current = voicing[stringIndex];

  return (
    <>
      <span className="flex h-8 items-center justify-center">
        <OpenOrMuted fret={current} />
      </span>

      {frets(firstFret).map((fret, index) => (
        <span
          className={cn(
            "relative flex h-8 items-center justify-center",
            index === 0 && firstFret === 1 && "border-foreground/70 border-l-4",
            "border-border border-r-2",
          )}
          key={fret}
        >
          <span aria-hidden="true" className="bg-muted-foreground/50 absolute inset-x-0 h-px" />
          {current === fret && (
            <NoteMark
              className="relative"
              kind={markOf?.(stringIndex) ?? "new"}
              label={nameOf(stringNoteMidi(stringIndex, fret))}
            />
          )}
        </span>
      ))}
    </>
  );
}

/**
 * A guitar neck in standard tuning, drawn the way tab reads it (high E on top) with a window of
 * frets. It shows a chord shape, or, with `onChange`, lets the learner pick one fret per string
 * with a pointer or the keyboard (each string is a radio group).
 */
export function GuitarFretboard(props: FretboardProps) {
  const name = useId();
  const { firstFret, label, onChange, stringNames } = props;

  return (
    <div
      aria-hidden={onChange ? undefined : true}
      aria-label={onChange ? label : undefined}
      className="grid w-full items-center"
      data-slot="guitar-fretboard"
      role={onChange ? "group" : undefined}
      style={gridColumns(Boolean(onChange))}
    >
      {STRINGS_TOP_DOWN.map((stringIndex) => (
        <div className="contents" key={stringIndex}>
          <span aria-hidden="true" className="text-muted-foreground text-xs font-medium">
            {stringNames[stringIndex]}
          </span>

          {onChange ? (
            <StringPicker
              {...props}
              name={`${name}-${stringIndex}`}
              onChange={onChange}
              stringIndex={stringIndex}
            />
          ) : (
            <StringRow {...props} stringIndex={stringIndex} />
          )}
        </div>
      ))}

      <span aria-hidden="true" />
      <span aria-hidden="true" />
      {onChange && <span aria-hidden="true" />}
      {frets(firstFret).map((fret) => (
        <span
          aria-hidden="true"
          className="text-muted-foreground pt-1 text-center text-xs tabular-nums"
          key={fret}
        >
          {fret}
        </span>
      ))}
    </div>
  );
}
