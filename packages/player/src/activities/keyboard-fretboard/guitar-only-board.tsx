"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivitySoundNote } from "../_components/activity-sound-button";
import { FRETBOARD_SPAN, GuitarFretboard } from "../_components/guitar-fretboard";
import { GUITAR_TUNING, type GuitarVoicing, stringNoteMidi } from "../_utils/guitar-voicing";
import { midiToNote } from "../_utils/music-notes";
import { together } from "../_utils/sound-events";
import { useFretboardLabels } from "../_utils/use-fretboard-labels";
import { useInstrument } from "../_utils/use-instrument";
import { useNoteNames } from "../_utils/use-music-labels";
import { type ActivityRendererProps } from "../activity-renderer";
import { GuitarMirror } from "./guitar-mirror";
import { KeyboardFretboardHeader } from "./keyboard-fretboard-header";
import {
  expectedPitches,
  fretWindowStart,
  initialPitches,
  pitchSpelling,
  targetPitches,
  voicingFor,
  voicingMidis,
  voicingPitches,
} from "./keyboard-fretboard-notes";

const OCTAVE = 12;
const STRUM_GAP = 0.04;
const HIGHEST_WINDOW = 12;
const NO_STRINGS: GuitarVoicing = GUITAR_TUNING.map(() => null);

function withFret(voicing: GuitarVoicing, stringIndex: number, fret: number | null) {
  return voicing.map((current, index) => (index === stringIndex ? fret : current));
}

/**
 * The guitar alone: pick one fret per string (or leave it muted) and hear the shape. Each string
 * is a radio group, and the window moves up the neck for shapes past the fourth fret.
 */
export function GuitarOnlyBoard({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: ActivityRendererProps<"keyboardFretboard">) {
  const t = useExtracted();
  const { display, spoken } = useNoteNames();
  const labels = useFretboardLabels();
  const guitar = useInstrument("guitar");
  const { check, fields } = content;
  const isChecked = phase === "checked";
  const spell = pitchSpelling([fields.target, fields.start]);

  const [voicing, setVoicing] = useState<GuitarVoicing>(
    () => voicingFor(initialPitches({ answer, content })) ?? NO_STRINGS,
  );

  const [firstFret, setFirstFret] = useState(() => fretWindowStart(voicing, FRETBOARD_SPAN));
  const played = voicingPitches(voicing);
  const expectedSet = expectedPitches(expected, targetPitches(fields.target));
  const showAnswer = isChecked && check.kind === "interaction";

  function handleChange(stringIndex: number, fret: number | null) {
    const next = withFret(voicing, stringIndex, fret);
    const midis = voicingMidis(next);
    setVoicing(next);

    if (fret !== null) {
      void guitar.play(together([stringNoteMidi(stringIndex, fret)]));
    }

    if (check.kind === "interaction") {
      onAnswerChange(
        midis.length > 0 ? { kind: "notes", notes: midis.map((midi) => midiToNote(midi)) } : null,
      );
    }
  }

  function markOf(stringIndex: number) {
    const fret = voicing[stringIndex];

    const pitch =
      fret === null || fret === undefined ? null : stringNoteMidi(stringIndex, fret) % OCTAVE;

    if (!showAnswer || pitch === null) {
      return "new" as const;
    }

    return expectedSet.includes(pitch) ? ("correct" as const) : ("wrong" as const);
  }

  return (
    <ActivityCanvas labelId={labelId}>
      <KeyboardFretboardHeader
        notes={played.map((pitch) => spell(pitch))}
        onHear={() => void guitar.play(together(voicingMidis(voicing), { gap: STRUM_GAP }))}
        target={fields.target}
      />

      <GuitarFretboard
        {...labels}
        firstFret={firstFret}
        label={t("Guitar strings")}
        markOf={markOf}
        nameOf={(midi) => display(spell(midi))}
        onChange={isChecked ? undefined : handleChange}
        voicing={voicing}
      />

      {!isChecked && (
        <div className="flex items-center justify-between gap-2">
          <Button
            aria-label={t("Lower frets")}
            disabled={firstFret <= 1}
            onClick={() => setFirstFret(firstFret - 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>

          <p aria-live="polite" className="text-muted-foreground text-sm tabular-nums">
            {t("Frets {from} to {to}", {
              from: String(firstFret),
              to: String(firstFret + FRETBOARD_SPAN - 1),
            })}
          </p>

          <Button
            aria-label={t("Higher frets")}
            disabled={firstFret >= HIGHEST_WINDOW}
            onClick={() => setFirstFret(firstFret + 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      )}

      {showAnswer && (
        <GuitarMirror
          caption={t("One way to play the answer")}
          isChecked
          pitches={expectedSet}
          spell={spell}
        />
      )}

      <ActivitySoundNote status={guitar.status} />

      <ActivityTextAlternative>
        {t("A guitar neck. Playing: {notes}.", {
          notes:
            played.length > 0 ? played.map((pitch) => spoken(spell(pitch))).join(", ") : t("none"),
        })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
