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
import { CHOICE_CONTROL_CLASS, CHOICE_ROW_CLASS } from "../choice-list";
import { StepForm } from "./step-form";

/** One of the notice's subjects: its name, and what learners call it when that's long. */
type ExamSubject = { name: string; shortName: string | null };

/**
 * An exam with several subjects asks which ones the learner already knows well instead of one
 * level for all of them: a law graduate knows the law subjects, not the IT ones. Their basics are
 * skipped and a quick test places the rest; "starting from scratch" skips the test. The subjects
 * are one grouped list, each named as learners say it (the notice's full name under it), with a
 * check once picked.
 */
export function SubjectsLevelStep({
  onAnswer,
  pending,
  subject,
  subjects,
}: {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  subject: string;
  subjects: ExamSubject[];
}) {
  const t = useExtracted();
  const [known, setKnown] = useState<string[]>([]);

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
          <label className={CHOICE_ROW_CLASS} key={item.name}>
            <ListRowContent>
              <ListRowTitle>{item.shortName ?? item.name}</ListRowTitle>
              {item.shortName && item.shortName !== item.name && (
                <ListRowDescription>{item.name}</ListRowDescription>
              )}
            </ListRowContent>
            <Checkbox
              aria-label={item.shortName ?? item.name}
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
