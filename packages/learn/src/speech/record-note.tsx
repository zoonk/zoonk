"use client";

import { useExtracted } from "next-intl";
import { useCheckNote } from "../_components/check-note";
import { CreateAccountLink } from "../_components/create-account-link";
import { useNoSpeechMessage } from "../language/no-speech-message";

export type RecordProblem = "failed" | "noSpeech" | "signUpRequired";

/**
 * The one line about recording, for the bar's `note` right over Record, on every screen that
 * records an answer. Null while a take is checked and the check isn't slow yet: the bar's busy
 * main action says it. `unavailable` is the screen's own line for a microphone it can't use.
 */
export function useRecordNote({
  acquiring,
  checking = false,
  problem = null,
  recording,
  unavailable = null,
}: {
  acquiring: boolean;
  checking?: boolean;
  problem?: RecordProblem | null;
  recording: boolean;
  unavailable?: string | null;
}): React.ReactNode {
  const t = useExtracted();
  const noSpeech = useNoSpeechMessage();
  const checkNote = useCheckNote({ checking, failed: !checking && problem === "failed" });

  if (unavailable) {
    return <p className="text-muted-foreground">{unavailable}</p>;
  }

  if (acquiring) {
    return (
      <p aria-hidden="true" className="text-muted-foreground">
        {t("Getting ready…")}
      </p>
    );
  }

  if (recording) {
    return (
      // A screen reader announcing it would speak into the take.
      <p aria-hidden="true" className="text-muted-foreground">
        {t({
          description: "“Stop” is the label of the button that ends the recording.",
          message: "Listening… Tap Stop to check.",
        })}
      </p>
    );
  }

  if (checking || checkNote) {
    return checkNote;
  }

  if (problem === "noSpeech") {
    return <p className="text-destructive-text">{noSpeech}</p>;
  }

  if (problem === "signUpRequired") {
    return (
      <div className="flex flex-col items-start gap-2 lg:items-end">
        <p className="text-muted-foreground">{t("This needs a free account")}</p>
        <CreateAccountLink />
      </div>
    );
  }

  return (
    <p className="text-muted-foreground">
      {t({
        description: "“Record” is the label of the button that starts the recording.",
        message: "Tap Record and say it out loud",
      })}
    </p>
  );
}
