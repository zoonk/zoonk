"use client";

import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { Checkbox } from "@zoonk/ui/components/checkbox";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  LIST_GROUP_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "../../_components/list-group";
import { CHOICE_ROW_CLASS } from "../choice-list";
import { CHOICE_CONTROL_CLASS } from "../choice-styles";
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
      continueLabel={known.length > 0 ? t("Continue") : t("None of them yet")}
      description={t("Your plan starts past their basics. A quick test places you in the rest.")}
      onContinue={() => onAnswer({ knownSubjects: known, level: null, question: "level" })}
      onSkip={() => onAnswer({ level: "none", question: "level" })}
      pending={pending}
      skipLabel={t("I'm starting from scratch")}
      subject={subject}
      title={t("Which subjects do you already know well?")}
    >
      <fieldset className={LIST_GROUP_CLASS}>
        <legend className="sr-only">{t("Subjects you know well")}</legend>
        {subjects.map((item) => (
          <label
            className={CHOICE_ROW_CLASS}
            data-highlighted={known.includes(item.name) || undefined}
            key={item.name}
          >
            <ListRowContent>
              <ListRowTitle>{item.shortName ?? item.name}</ListRowTitle>
              {item.shortName && item.shortName !== item.name && (
                <ListRowDescription>{item.name}</ListRowDescription>
              )}
            </ListRowContent>
            <Checkbox
              checked={known.includes(item.name)}
              className={CHOICE_CONTROL_CLASS}
              onCheckedChange={(checked) =>
                setKnown(
                  checked ? [...known, item.name] : known.filter((name) => name !== item.name),
                )
              }
            />
          </label>
        ))}
      </fieldset>
    </StepForm>
  );
}
