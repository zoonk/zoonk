"use client";

import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { CheckList } from "../choice-list";
import { StepForm } from "./step-form";

type ExamSubject = { name: string; shortName: string | null };

export function SubjectsLevelStep({
  initialKnown,
  onAnswer,
  pending,
  subject,
  subjects,
}: {
  initialKnown: readonly string[];
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  subject: string;
  subjects: ExamSubject[];
}) {
  const t = useExtracted();

  const [known, setKnown] = useState<string[]>(() =>
    initialKnown.filter((name) => subjects.some((item) => item.name === name)),
  );

  return (
    <StepForm
      description={t("Your plan skips their basics.")}
      onContinue={() => onAnswer({ knownSubjects: known, level: null, question: "level" })}
      onSkip={() => onAnswer({ level: "none", question: "level" })}
      pending={pending}
      skipLabel={t("I'm new to all of them")}
      subject={subject}
      title={t("Which subjects do you already know well?")}
    >
      <CheckList
        choices={subjects.map((item) => ({
          description: item.shortName && item.shortName !== item.name ? item.name : undefined,
          label: item.shortName ?? item.name,
          value: item.name,
        }))}
        label={t("Subjects you know well")}
        onChange={setKnown}
        value={known}
      />
    </StepForm>
  );
}
