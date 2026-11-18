"use client";

import { type LanguageReason, type LanguageReasonView } from "@zoonk/core/language/aims";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useReasonCopy } from "../../language-aim/use-reason-copy";
import { getCertificateExample } from "../_utils/certificate-example";
import { type Choice, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";
import { TextField } from "./text-field";
import { useAdvanceOnPick } from "./use-advance-on-pick";

function asksWords(reason: LanguageReason | null): boolean {
  return reason === "certificate" || reason === "other";
}

function ReasonWords({
  onChange,
  reason,
  value,
}: {
  onChange: (value: string) => void;
  reason: LanguageReason;
  value: string;
}) {
  const t = useExtracted();

  return (
    <TextField
      label={reason === "certificate" ? t("Which exam?") : t("In your own words")}
      onChange={onChange}
      value={value}
    />
  );
}

/** A reason with a level moves on when it's picked; a certificate and Something else ask for words. */
export function ReasonStep({
  onAnswer,
  pending,
  reasons,
  subject,
  targetLanguage,
  targetRegion,
}: {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  reasons: readonly LanguageReasonView[];
  subject: string;
  targetLanguage: string | null;
  targetRegion: string | null;
}) {
  const t = useExtracted();
  const copyFor = useReasonCopy();
  const [reason, setReason] = useState<LanguageReason | null>(null);
  const [words, setWords] = useState("");

  const { cancel, pick, submit } = useAdvanceOnPick({
    answer: (picked: LanguageReason) =>
      onAnswer({
        question: "reason",
        reason: picked,
        words: asksWords(picked) ? words.trim() || null : undefined,
      }),
    pending,
  });

  const example = getCertificateExample({ language: targetLanguage, region: targetRegion });

  const choices: Choice<LanguageReason>[] = reasons.map((view) => ({
    ...copyFor(view),
    after:
      view.reason === reason && asksWords(reason) ? (
        <ReasonWords onChange={setWords} reason={view.reason} value={words} />
      ) : undefined,
    ...(view.reason === "certificate" && { description: example }),
    value: view.reason,
  }));

  return (
    <StepForm
      canContinue={reason !== null && (reason !== "certificate" || words.trim().length > 0)}
      onContinue={() => reason && submit(reason)}
      pending={pending}
      subject={subject}
      title={t("Why are you learning it?")}
    >
      <ChoiceList
        choices={choices}
        label={t("Why you're learning it")}
        onChange={setReason}
        onPick={(picked) => (asksWords(picked) ? cancel() : pick(picked))}
        readOnly={pending}
        value={reason}
      />
    </StepForm>
  );
}
