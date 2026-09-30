"use client";

import { semitones } from "@zoonk/core/library/activities/music";
import { useExtracted } from "next-intl";
import { ActivityCanvasLabel } from "../_components/activity-canvas";
import { ActivitySoundButton } from "../_components/activity-sound-button";
import { type NoteMarkKind } from "../_components/note-mark";
import { PianoKeyboard } from "../_components/piano-keyboard";
import { midiToNote, spellChord, spellInterval } from "../_utils/music-notes";
import { useNoteNames } from "../_utils/use-music-labels";
import { type ActivityRendererProps } from "../activity-renderer";
import { type EarOption, keyboardRange, playedMidis } from "./ear-trainer-sounds";

type EarTrainerFields = ActivityRendererProps<"earTrainer">["content"]["fields"];

/** The notes that played, spelled from their root: C and G, or C, E♭ and G. */
function playedNames(fields: EarTrainerFields): string[] {
  if (fields.mode === "interval") {
    return [fields.root.replace(/\d$/u, ""), spellInterval(fields.root, fields.played)];
  }

  if (fields.mode === "chord") {
    return spellChord(fields.root, fields.played);
  }

  const hidden = fields.chords[fields.hidden];
  return hidden ? spellChord(hidden.root, hidden.quality) : [];
}

/**
 * After the check: what played, on the keys, with the distance in half steps for an interval,
 * the song that helps remember it, and a way to hear a wrong pick to compare.
 */
export function EarTrainerAnswer({
  chosen,
  correct,
  fields,
  onCompare,
}: {
  chosen: EarOption | null;
  correct: EarOption | null;
  fields: EarTrainerFields;
  onCompare: (option: EarOption) => void;
}) {
  const t = useExtracted();
  const { display, spoken } = useNoteNames();
  const midis = playedMidis(fields);
  const names = playedNames(fields);
  const nameOf = (midi: number) => names[midis.indexOf(midi)] ?? midiToNote(midi);
  const marks = new Map<number, NoteMarkKind>(midis.map((midi) => [midi, "heard"]));
  const range = keyboardRange(midis);
  const isWrong = chosen !== null && chosen.id !== correct?.id;

  return (
    <div className="border-border flex flex-col gap-3 border-t pt-3">
      <ActivityCanvasLabel>
        {fields.mode === "interval"
          ? t("{count, plural, one {# half step} other {# half steps}}: {notes}", {
              count: semitones(fields.played),
              notes: names.map((name) => display(name)).join(" → "),
            })
          : t("What played: {notes}", { notes: names.map((name) => display(name)).join(", ") })}
      </ActivityCanvasLabel>

      <PianoKeyboard
        className="h-28"
        from={range.from}
        label={t("The notes that played")}
        marks={marks}
        nameOf={(midi) => display(nameOf(midi))}
        spokenNameOf={(midi) => spoken(nameOf(midi))}
        to={range.to}
      />

      {correct?.song && (
        <p className="text-sm leading-snug">
          <span className="text-muted-foreground">{t("You know it from:")}</span>{" "}
          <span className="font-medium">{correct.song}</span>
        </p>
      )}

      {isWrong && (
        <ActivitySoundButton className="self-start" onPlay={() => onCompare(chosen)}>
          {t("Hear your pick to compare")}
        </ActivitySoundButton>
      )}
    </div>
  );
}
