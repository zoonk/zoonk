"use client";

import { useExtracted } from "next-intl";
import { useCheckNote } from "../_components/check-note";
import { CreateAccountLink } from "../_components/create-account-link";
import { useNoSpeechMessage } from "../language/no-speech-message";

export type RecordProblem = "failed" | "missedStart" | "noSpeech" | "signUpRequired";

/**
 * The one line about a problem with recording, for the bar's `note` right over Record, on every
 * screen that records an answer; the screen's `RecordCue` says when to talk. Null while a take is
 * on, and while it's checked and the check isn't slow yet: the bar's busy main action says it.
 * `unavailable` is the screen's own line for a microphone it can't use.
 */
export function useRecordNote({
  checking = false,
  problem = null,
  recording,
  unavailable = null,
}: {
  checking?: boolean;
  problem?: RecordProblem | null;
  /** Getting ready or recording. */
  recording: boolean;
  unavailable?: string | null;
}): React.ReactNode {
  const t = useExtracted();
  const noSpeech = useNoSpeechMessage();
  const checkNote = useCheckNote({ checking, failed: !checking && problem === "failed" });

  if (unavailable) {
    return <p className="text-muted-foreground">{unavailable}</p>;
  }

  if (recording) {
    return null;
  }

  if (checking || checkNote) {
    return checkNote;
  }

  if (problem === "noSpeech") {
    return <p className="text-destructive-text">{noSpeech}</p>;
  }

  if (problem === "missedStart") {
    return <p>{t("We may have missed the start. Say it again.")}</p>;
  }

  if (problem === "signUpRequired") {
    return (
      <div className="flex flex-col items-start gap-2 lg:items-end">
        <p className="text-muted-foreground">{t("This needs a free account")}</p>
        <CreateAccountLink />
      </div>
    );
  }

  return null;
}
