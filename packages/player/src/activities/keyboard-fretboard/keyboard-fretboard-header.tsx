"use client";

import { useExtracted } from "next-intl";
import { ActivitySoundButton } from "../_components/activity-sound-button";
import { useChordName, useNoteNames } from "../_utils/use-music-labels";
import { type NoteTarget } from "./keyboard-fretboard-notes";

type ByEar = { isRevealed: boolean; onPlay: () => void };

export function KeyboardFretboardHeader({
  byEar,
  notes,
  onHear,
  target,
}: {
  byEar: ByEar | null;
  notes: readonly string[];
  onHear: () => void;
  target: NoteTarget;
}) {
  const t = useExtracted();
  const chordName = useChordName();
  const { display, spoken } = useNoteNames();

  function title() {
    if (byEar && !byEar.isRevealed) {
      return t("By ear");
    }

    return target.kind === "chord"
      ? chordName(target.root, target.quality)
      : t("{count, plural, one {# note} other {# notes}}", { count: target.notes.length });
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-lg leading-tight font-semibold">{title()}</p>

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

      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {byEar && (
          <ActivitySoundButton onPlay={byEar.onPlay}>{t("Play the sound")}</ActivitySoundButton>
        )}

        <ActivitySoundButton disabled={notes.length === 0} onPlay={onHear}>
          {t("Hear it")}
        </ActivitySoundButton>
      </div>
    </div>
  );
}
