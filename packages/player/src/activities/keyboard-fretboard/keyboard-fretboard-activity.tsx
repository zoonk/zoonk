"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivitySoundNote } from "../_components/activity-sound-button";
import { type NoteMarkKind } from "../_components/note-mark";
import { PianoKeyboard } from "../_components/piano-keyboard";
import { together } from "../_utils/sound-events";
import { useInstrument } from "../_utils/use-instrument";
import { useNoteNames } from "../_utils/use-music-labels";
import { type ActivityRendererProps } from "../activity-renderer";
import { GuitarMirror } from "./guitar-mirror";
import { GuitarOnlyBoard } from "./guitar-only-board";
import { KeyboardFretboardHeader } from "./keyboard-fretboard-header";
import {
  KEYBOARD_FROM,
  KEYBOARD_TO,
  answeringMarks,
  checkedMarks,
  expectedPitches,
  initialPitches,
  pitchSpelling,
  pitchesToNotes,
  targetPitches,
  togglePitch,
} from "./keyboard-fretboard-notes";

type KeyboardFretboardProps = ActivityRendererProps<"keyboardFretboard">;

const OCTAVE = 12;
const CHORD_GAP = 0.03;

function PianoBoard(props: KeyboardFretboardProps) {
  const t = useExtracted();
  const { display, spoken } = useNoteNames();
  const { content, expected, labelId, onAnswerChange, phase } = props;
  const { check, fields } = content;
  const piano = useInstrument("piano");
  const [pressed, setPressed] = useState(() => initialPitches(props));
  const isChecked = phase === "checked";
  const start = targetPitches(fields.start);
  const target = targetPitches(fields.target);
  const spell = pitchSpelling([fields.target, fields.start]);
  const showAnswer = isChecked && check.kind === "interaction";
  const shown = showAnswer ? expectedPitches(expected, target) : pressed;
  const notes = pressed.map((pitch) => spell(pitch));

  const marks: Map<number, NoteMarkKind> = showAnswer
    ? checkedMarks({ expected: shown, pressed })
    : answeringMarks({ pressed, start });

  function handlePress(midi: number) {
    const next = togglePitch(pressed, midi % OCTAVE);
    setPressed(next);

    if (next.includes(midi % OCTAVE)) {
      void piano.play(together([midi]));
    } else {
      piano.stop();
    }

    if (check.kind === "interaction") {
      onAnswerChange(next.length > 0 ? { kind: "notes", notes: pitchesToNotes(next) } : null);
    }
  }

  return (
    <ActivityCanvas labelId={labelId}>
      <KeyboardFretboardHeader
        notes={showAnswer ? shown.map((pitch) => spell(pitch)) : notes}
        onHear={() =>
          void piano.play(
            together(
              (showAnswer ? shown : pressed).map((pitch) => KEYBOARD_FROM + pitch),
              { gap: CHORD_GAP },
            ),
          )
        }
        target={fields.target}
      />

      <PianoKeyboard
        disabled={isChecked}
        from={KEYBOARD_FROM}
        label={t("Piano keys")}
        marks={marks}
        nameOf={(midi) => display(spell(midi))}
        onPress={isChecked ? undefined : handlePress}
        pressed={(midi) => pressed.includes(midi % OCTAVE)}
        spokenNameOf={(midi) => spoken(spell(midi))}
        to={KEYBOARD_TO}
      />

      {fields.instruments.includes("guitar") && (
        <GuitarMirror isChecked={showAnswer} pitches={shown} spell={spell} />
      )}

      <ActivitySoundNote status={piano.status} />

      <ActivityTextAlternative>
        {t("A piano keyboard from C to B. Pressed: {notes}.", {
          notes: notes.length > 0 ? notes.map((note) => spoken(note)).join(", ") : t("none"),
        })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

/**
 * Press notes on a piano keyboard, or pick frets on a guitar, and see them on both. The keys
 * start with the start chord when there is one ("change one note"); the answer is the notes
 * pressed, graded by pitch class. With a choice check the instrument is free to explore.
 */
export function KeyboardFretboardActivity(props: KeyboardFretboardProps) {
  if (props.content.fields.instruments.includes("piano")) {
    return <PianoBoard {...props} />;
  }

  return <GuitarOnlyBoard {...props} />;
}
