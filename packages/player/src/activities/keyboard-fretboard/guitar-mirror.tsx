"use client";

import { useExtracted } from "next-intl";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import { FRETBOARD_SPAN, GuitarFretboard } from "../_components/guitar-fretboard";
import { nameChord } from "../_utils/music-notes";
import { useFretboardLabels } from "../_utils/use-fretboard-labels";
import { useNoteNames } from "../_utils/use-music-labels";
import { fretWindowStart, voicingFor } from "./keyboard-fretboard-notes";

/**
 * The notes on the keys as a guitar shape a hand can play, so a learner sees one idea on both
 * instruments. It follows the keys; after the check it shows the answer.
 */
export function GuitarMirror({
  caption,
  isChecked,
  pitches,
  spell,
}: {
  /** What the shape shows; by default "Same chord on guitar" or "Same notes on guitar". */
  caption?: string;
  isChecked: boolean;
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
          markOf={() => (isChecked ? "correct" : "new")}
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
