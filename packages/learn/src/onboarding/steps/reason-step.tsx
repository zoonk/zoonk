"use client";

import { type LanguageReason, type LanguageReasonView } from "@zoonk/core/language/aims";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useReasonCopy } from "../../language-aim/use-reason-copy";
import { type Choice, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";
import { TextField } from "./text-field";
import { useAdvanceOnPick } from "./use-advance-on-pick";

function asksWords(reason: LanguageReason | null): boolean {
  return reason === "certificate" || reason === "other";
}

function ReasonSize({ view }: { view: LanguageReasonView }) {
  const t = useExtracted();

  return (
    <span className="text-foreground shrink-0 self-center font-mono text-xs font-medium tabular-nums">
      {view.aim ??
        t({
          description: "Beside a language goal's reason: a certificate's plan follows its exam.",
          message: "Exam",
        })}
    </span>
  );
}

/** The field sits inside the reasons' radio group, whose arrow keys would move off it. */
function keepKeys(event: React.KeyboardEvent<HTMLInputElement>) {
  event.stopPropagation();
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
    <div className="py-3 pl-8">
      <TextField
        label={reason === "certificate" ? t("Which one?") : t("In your own words")}
        onChange={onChange}
        onKeyDown={keepKeys}
        value={value}
      />
    </div>
  );
}

/** A reason with a level moves on when it's picked; a certificate and Something else ask for words. */
export function ReasonStep({
  onAnswer,
  pending,
  reasons,
  subject,
}: {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  reasons: readonly LanguageReasonView[];
  subject: string;
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

  const choices: Choice<LanguageReason>[] = reasons.map((view) => ({
    ...copyFor(view),
    after:
      view.reason === reason && asksWords(reason) ? (
        <ReasonWords onChange={setWords} reason={view.reason} value={words} />
      ) : undefined,
    trailing: <ReasonSize view={view} />,
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
