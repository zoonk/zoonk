"use client";

import { useExtracted } from "next-intl";
import { ActivitySoundButton } from "../_components/activity-sound-button";
import { useChordName, useNoteNames } from "../_utils/use-music-labels";
import { type NoteTarget } from "./keyboard-fretboard-notes";

/**
 * What the learner is looking for (the chord's name, or how many notes) and the notes on the
 * keys now, with a button to hear them. The notes line is live, so screen readers hear each
 * change.
 */
export function KeyboardFretboardHeader({
  notes,
  onHear,
  target,
}: {
  notes: readonly string[];
  onHear: () => void;
  target: NoteTarget;
}) {
  const t = useExtracted();
  const chordName = useChordName();
  const { display, spoken } = useNoteNames();

  const title =
    target.kind === "chord"
      ? chordName(target.root, target.quality)
      : t("{count, plural, one {# note} other {# notes}}", { count: target.notes.length });

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="in-data-[mode=fun]:font-fun-display text-lg leading-tight font-semibold">
          {title}
        </p>

        <p aria-live="polite" className="text-muted-foreground text-sm">
          <span aria-hidden="true">
            {notes.length > 0 ? notes.map((note) => display(note)).join(", ") : t("No notes yet")}
          </span>
          <span className="sr-only">
            {notes.length > 0
              ? t("On the keys: {notes}", { notes: notes.map((note) => spoken(note)).join(", ") })
              : t("No notes yet")}
          </span>
        </p>
      </div>

      <ActivitySoundButton disabled={notes.length === 0} onPlay={onHear}>
        {t("Hear it")}
      </ActivitySoundButton>
    </div>
  );
}
