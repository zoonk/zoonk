"use client";

import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../../_components/save-error";
import { TestOutcome } from "../test-outcome";

/** A test that's over and not saved yet: the learner came back to it, or its last save failed. */
export function PlacementDone({
  failed,
  onContinue,
  pending,
}: {
  failed?: boolean;
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <TestOutcome
      busy={pending}
      note={
        failed && (
          <ChangeSaveError>{t("That didn't go through. Try again in a moment.")}</ChangeSaveError>
        )
      }
      onContinue={onContinue}
      title={t("Your answers are saved")}
    />
  );
}

export function PlacementUnavailable({
  failed,
  onContinue,
  pending,
}: {
  failed?: boolean;
  onContinue: () => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <TestOutcome
      busy={pending}
      failed={failed}
      onContinue={onContinue}
      title={t("We'll see what you know in your first few days")}
    />
  );
}
