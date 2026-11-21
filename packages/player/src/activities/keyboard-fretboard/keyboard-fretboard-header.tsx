"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ActivitySoundButton } from "../_components/activity-sound-button";
import { useChordName, useNoteNames } from "../_utils/use-music-labels";
import {
  type KeyboardHeading,
  type NoteTarget,
  changesOneHalfStep,
} from "./keyboard-fretboard-notes";

type ByEar = { onPlay: (() => void) | null };

export function KeyboardFretboardInstruction() {
  const t = useExtracted();

  return <p className="text-muted-foreground text-sm">{t("Play the sound, then pick.")}</p>;
}

export function KeyboardHalfStepHint({
  start,
  target,
}: {
  start: readonly number[];
  target: readonly number[];
}) {
  const t = useExtracted();

  return changesOneHalfStep(start, target) ? (
    <p className="text-muted-foreground text-sm">
      {t("A half step is the distance to the next key, counting black keys.")}
    </p>
  ) : null;
}

export function KeyboardFretboardHeader({
  byEar,
  checked,
  heading,
  notes,
  onHear,
  start,
  target,
}: {
  byEar: ByEar | null;
  checked: boolean;
  heading: KeyboardHeading;
  notes: readonly string[];
  onHear?: () => void;
  start?: NoteTarget;
  target: NoteTarget;
}) {
  const t = useExtracted();
  const chordName = useChordName();
  const { display, spoken } = useNoteNames();

  function nameOf(shown: NoteTarget) {
    return shown.kind === "chord"
      ? chordName(shown.root, shown.quality)
      : t("{count, plural, one {# note} other {# notes}}", { count: shown.notes.length });
  }

  function title() {
    if (heading === "byEar" || heading === "yours") {
      return t("Your notes");
    }

    return nameOf(heading === "start" && start ? start : target);
  }

  return (
    <div className="flex flex-col gap-3">
      {(onHear || checked) && (
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-lg leading-tight font-semibold">{title()}</p>

          {onHear && (
            <p aria-live="polite" className="text-muted-foreground text-sm">
              <span aria-hidden="true">
                {notes.length > 0
                  ? notes.map((note) => display(note)).join(", ")
                  : t("No notes yet")}
              </span>
              <span className="sr-only">
                {notes.length > 0
                  ? t("On the keys: {notes}", {
                      notes: notes.map((note) => spoken(note)).join(", "),
                    })
                  : t("No notes yet")}
              </span>
            </p>
          )}
        </div>
      )}

      <div className={cn("grid w-fit max-w-full gap-2", byEar?.onPlay && "sm:grid-cols-2")}>
        {byEar?.onPlay && (
          <ActivitySoundButton className="justify-start" onPlay={byEar.onPlay}>
            {t("Play the sound")}
          </ActivitySoundButton>
        )}

        {onHear && (
          <ActivitySoundButton
            className="justify-start"
            disabled={notes.length === 0 || (byEar !== null && checked)}
            onPlay={onHear}
          >
            {byEar ? t("Hear your notes") : t("Play the sound")}
          </ActivitySoundButton>
        )}
      </div>
    </div>
  );
}
