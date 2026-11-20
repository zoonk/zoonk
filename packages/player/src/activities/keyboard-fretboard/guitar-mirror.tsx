"use client";

import { useExtracted } from "next-intl";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import { FRETBOARD_SPAN, GuitarFretboard } from "../_components/guitar-fretboard";
import { type NoteMarkKind } from "../_components/note-mark";
import { type GuitarVoicing, stringNoteMidi } from "../_utils/guitar-voicing";
import { nameChord } from "../_utils/music-notes";
import { useFretboardLabels } from "../_utils/use-fretboard-labels";
import { useNoteNames } from "../_utils/use-music-labels";
import { fretWindowStart, voicingFor } from "./keyboard-fretboard-notes";

const OCTAVE = 12;

function stringMark({
  kindOf,
  stringIndex,
  voicing,
}: {
  kindOf: (pitch: number) => NoteMarkKind;
  stringIndex: number;
  voicing: GuitarVoicing;
}): NoteMarkKind {
  const fret = voicing[stringIndex];

  return fret === null || fret === undefined
    ? "new"
    : kindOf(stringNoteMidi(stringIndex, fret) % OCTAVE);
}

/** The keyboard's notes on a guitar, each in the mark it has on the keys. */
export function GuitarMirror({
  caption,
  kindOf,
  pitches,
  spell,
}: {
  caption?: string;
  kindOf: (pitch: number) => NoteMarkKind;
  pitches: readonly number[];
  spell: (pitch: number) => string;
}) {
  const t = useExtracted();
  const { display } = useNoteNames();
  const labels = useFretboardLabels();
  const voicing = voicingFor(pitches);

  if (pitches.length === 0) {
    return null;
  }

  const title =
    caption ?? (nameChord(pitches) ? t("Same chord on guitar") : t("Same notes on guitar"));

  return (
    <div className="border-border flex flex-col gap-2 border-t pt-3">
      <ActivityCanvasLabel>{title}</ActivityCanvasLabel>

      {voicing ? (
        <GuitarFretboard
          {...labels}
          firstFret={fretWindowStart(voicing, FRETBOARD_SPAN)}
          label={title}
          markOf={(stringIndex) => stringMark({ kindOf, stringIndex, voicing })}
          nameOf={(midi) => display(spell(midi))}
          voicing={voicing}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("These notes don't fit in one hand shape on the guitar.")}
        </p>
      )}
    </div>
  );
}
