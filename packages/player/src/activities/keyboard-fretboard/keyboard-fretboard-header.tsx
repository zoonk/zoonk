"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ActivitySoundButton } from "../_components/activity-sound-button";
import { useChordName, useNoteNames } from "../_utils/use-music-labels";
import { type KeyboardHeading, type NoteTarget } from "./keyboard-fretboard-notes";

type ByEar = { isRevealed: boolean; onPlay: (() => void) | null };

export function KeyboardFretboardHeader({
  byEar,
  heading,
  notes,
  onHear,
  start,
  target,
}: {
  byEar: ByEar | null;
  heading: KeyboardHeading;
  notes: readonly string[];
  onHear: () => void;
  start?: NoteTarget;
  target: NoteTarget;
}) {
  const t = useExtracted();
  const chordName = useChordName();
  const { display, spoken } = useNoteNames();

  const isGuessing = byEar !== null && !byEar.isRevealed;

  function nameOf(shown: NoteTarget) {
    return shown.kind === "chord"
      ? chordName(shown.root, shown.quality)
      : t("{count, plural, one {# note} other {# notes}}", { count: shown.notes.length });
  }

  function title() {
    if (heading === "byEar") {
      return t("By ear");
    }

    if (heading === "yours") {
      return t("Your notes");
    }

    return nameOf(heading === "start" && start ? start : target);
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
        {isGuessing && byEar.onPlay && (
          <ActivitySoundButton onPlay={byEar.onPlay}>{t("Play the sound")}</ActivitySoundButton>
        )}

        {/* While the sound is a mystery there are two sounds to hear, so each button names its own. */}
        <ActivitySoundButton disabled={notes.length === 0} onPlay={onHear}>
          {isGuessing ? t("Hear your notes") : t("Hear it")}
        </ActivitySoundButton>
      </div>
    </div>
  );
}
