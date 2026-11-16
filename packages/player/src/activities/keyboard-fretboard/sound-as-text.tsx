"use client";

import { EarIcon, EarOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepWayOut } from "../../components/step-way-out";
import { CANT_LISTEN_TODAY, useTodayChoice } from "../../lesson/use-today-choice";
import { useNoteNames } from "../_utils/use-music-labels";

export function useCantListen() {
  return useTodayChoice(CANT_LISTEN_TODAY);
}

/** The notes a by-ear sound plays, as text for a learner who can't listen, and at once when the sound can't load. */
export function SoundAsText({ notes }: { notes: readonly string[] }) {
  const t = useExtracted();
  const { display, spoken } = useNoteNames();

  return (
    <p aria-live="polite" className="text-sm">
      <span aria-hidden="true">
        {t("The sound plays: {notes}", { notes: notes.map((note) => display(note)).join(", ") })}
      </span>
      <span className="sr-only">
        {t("The sound plays: {notes}", { notes: notes.map((note) => spoken(note)).join(", ") })}
      </span>
    </p>
  );
}

/** The way around listening, under the card on the column, where a speaking screen has "I can't talk now". */
export function CantListenSwitch({
  cantListen,
  onChange,
}: {
  cantListen: boolean;
  onChange: (cantListen: boolean) => void;
}) {
  const t = useExtracted();

  return (
    <StepWayOut
      icon={cantListen ? <EarIcon aria-hidden="true" /> : <EarOffIcon aria-hidden="true" />}
      onClick={() => onChange(!cantListen)}
    >
      {cantListen ? t("I can listen now") : t("I can't listen now")}
    </StepWayOut>
  );
}
