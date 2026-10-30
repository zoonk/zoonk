"use client";

import { Button } from "@zoonk/ui/components/button";
import { EarIcon, EarOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { COLUMN_GHOST_ACTION_CLASS } from "../../components/step-layouts";
import { CANT_LISTEN_TODAY, useTodayChoice } from "../../lesson/use-today-choice";
import { useNoteNames } from "../_utils/use-music-labels";

export function useCantListen() {
  return useTodayChoice(CANT_LISTEN_TODAY);
}

/** The notes a by-ear sound plays, as text for a learner who can't listen, and at once when the sound can't load. */
export function SoundAsText({
  cantListen,
  isAnswering,
  notes,
  onCantListenChange,
  soundUnavailable,
}: {
  cantListen: boolean;
  isAnswering: boolean;
  notes: readonly string[];
  onCantListenChange: (cantListen: boolean) => void;
  soundUnavailable: boolean;
}) {
  const t = useExtracted();
  const { display, spoken } = useNoteNames();

  return (
    <>
      {(cantListen || soundUnavailable) && (
        <p aria-live="polite" className="text-sm">
          <span aria-hidden="true">
            {t("The sound plays: {notes}", {
              notes: notes.map((note) => display(note)).join(", "),
            })}
          </span>
          <span className="sr-only">
            {t("The sound plays: {notes}", { notes: notes.map((note) => spoken(note)).join(", ") })}
          </span>
        </p>
      )}

      {isAnswering && (cantListen || !soundUnavailable) && (
        <Button
          className={COLUMN_GHOST_ACTION_CLASS}
          onClick={() => onCantListenChange(!cantListen)}
          size="sm"
          variant="ghost"
        >
          {cantListen ? <EarIcon aria-hidden="true" /> : <EarOffIcon aria-hidden="true" />}
          {cantListen ? t("I can listen now") : t("I can't listen now")}
        </Button>
      )}
    </>
  );
}
