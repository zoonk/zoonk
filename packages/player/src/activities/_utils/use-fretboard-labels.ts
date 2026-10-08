"use client";

import { useExtracted } from "next-intl";
import { GUITAR_TUNING } from "./guitar-voicing";
import { midiToNote } from "./music-notes";
import { useNoteNames } from "./use-music-labels";

const OPEN_STRING_NAMES = ["E", "A", "D", "G", "B", "E"] as const;

/** Names for a guitar neck: the strings on the left and what each position is called aloud. */
export function useFretboardLabels() {
  const t = useExtracted();
  const { display, spoken } = useNoteNames();

  const stringNames = OPEN_STRING_NAMES.map((name) => display(name));

  function stringLabel(stringIndex: number): string {
    if (stringIndex === 0) {
      return t("Low E string");
    }

    if (stringIndex === GUITAR_TUNING.length - 1) {
      return t("High E string");
    }

    return t("{note} string", { note: spoken(OPEN_STRING_NAMES[stringIndex] ?? "E") });
  }

  function positionLabel(fret: number | null, midi: number | null): string {
    if (fret === null || midi === null) {
      return t("Not played");
    }

    const note = spoken(midiToNote(midi));

    return fret === 0
      ? t("Open, {note}", { note })
      : t("Fret {fret}, {note}", { fret: String(fret), note });
  }

  return { positionLabel, stringLabel, stringNames };
}
