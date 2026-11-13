"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ActivitySoundButton } from "../_components/activity-sound-button";
import { useChordName, useNoteNames } from "../_utils/use-music-labels";
import { type NoteTarget } from "./keyboard-fretboard-notes";

type ByEar = { isRevealed: boolean; onPlay: (() => void) | null };

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
    <div
      className={cn(
        "flex gap-3",
        // Two buttons leave the title no room beside them on a phone, so they take their own row.
        byEar ? "flex-col" : "items-start justify-between",
      )}
    >
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

      <div className={cn("flex shrink-0 flex-wrap gap-2", !byEar && "justify-end")}>
        {byEar?.onPlay && (
          <ActivitySoundButton onPlay={byEar.onPlay}>{t("Play the sound")}</ActivitySoundButton>
        )}

        <ActivitySoundButton disabled={notes.length === 0} onPlay={onHear}>
          {t("Hear it")}
        </ActivitySoundButton>
      </div>
    </div>
  );
}
