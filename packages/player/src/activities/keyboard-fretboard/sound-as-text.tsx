"use client";

import { EarIcon, EarOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepWayOut } from "../../components/step-way-out";
import { CANT_LISTEN_TODAY, useTodayChoice } from "../../lesson/use-today-choice";
import { useNoteNames } from "../_utils/use-music-labels";
import { type ActivityPhase } from "../activity-renderer";

export function useKeyboardListening({
  byEar,
  onPlay,
  phase,
  unavailable,
}: {
  byEar?: boolean;
  onPlay: () => void;
  phase: ActivityPhase;
  unavailable: boolean;
}) {
  const [cantListen, setCantListen] = useTodayChoice(CANT_LISTEN_TODAY);
  const isAnsweringByEar = byEar && phase === "answering";

  return {
    cantListen,
    earControls: byEar && phase !== "explore" ? { onPlay: cantListen ? null : onPlay } : null,
    offersWayOut: isAnsweringByEar && (cantListen || !unavailable),
    setCantListen,
    showInstruction: isAnsweringByEar && !cantListen && !unavailable,
    showText: isAnsweringByEar && (cantListen || unavailable),
  };
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
