"use client";

import { useExtracted } from "next-intl";
import { useCheckNote } from "../_components/check-note";
import { CreateAccountLink } from "../_components/create-account-link";
import { useNoSpeechMessage } from "../language/no-speech-message";

export type RecordProblem = "failed" | "missedStart" | "noSpeech" | "signUpRequired";

export function useRecordNote({
  checking = false,
  problem = null,
  recording,
  unavailable = null,
}: {
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
