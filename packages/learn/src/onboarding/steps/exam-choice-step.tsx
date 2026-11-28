"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { PageSectionTitle } from "../../_components/page";
import { ExamPickLimit } from "../../plan/exam-choice-picks";
import { CheckList, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";

type Picks = Record<string, string[]>;

export function ExamChoiceStep({
  choices,
  onAnswer,
  pending,
  subject,
}: {
  choices: ExamChoiceView[];
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  subject: string;
}) {
  const t = useExtracted();

  const [picks, setPicks] = useState<Picks>(() =>
    Object.fromEntries(choices.map((choice) => [choice.group, choice.subjects])),
  );

  const isComplete = choices.every((choice) => (picks[choice.group] ?? []).length > 0);
  const required = choices.some((choice) => choice.required);
  const takes = choices.reduce((sum, choice) => sum + choice.take, 0);

  const answerWith = (picked: Picks) =>
    onAnswer({
      choices: choices.flatMap((choice) => {
        const names = picked[choice.group] ?? [];

        const subjects = choice.options.flatMap((option) =>
          names.includes(option.name) ? [option.name] : [],
        );

        return subjects.length > 0 ? [{ group: choice.group, subjects }] : [];
      }),
      question: "examChoice",
      timeZone: getLocalTimeZone(),
    });

  return (
    <StepForm
      canContinue={isComplete}
      onContinue={() => answerWith(picks)}
      onSkip={required ? undefined : () => onAnswer({ choices: null, question: "examChoice" })}
      pending={pending}
      skipLabel={t("Decide later")}
      subject={subject}
      title={t(
        "{count, plural, one {Which one will you take?} other {Which ones will you take?}}",
        { count: takes },
      )}
    >
      {choices.map((choice) => {
        const options = choice.options.map((option) => ({
          label: option.shortName ?? option.name,
          value: option.name,
        }));

        return (
          <section className="flex flex-col gap-1" key={choice.group}>
            <PageSectionTitle>{choice.group}</PageSectionTitle>

            {choice.take > 1 ? (
              <>
                <ExamPickLimit take={choice.take} />

                <CheckList
                  choices={options}
                  label={choice.group}
                  max={choice.take}
                  numberKeys={choices.length === 1}
                  onChange={(names) => setPicks({ ...picks, [choice.group]: names })}
                  readOnly={pending}
                  value={picks[choice.group] ?? []}
                />
              </>
            ) : (
              <ChoiceList
                choices={options}
                label={choice.group}
                numberKeys={choices.length === 1}
                onChange={(value) => setPicks({ ...picks, [choice.group]: [value] })}
                readOnly={pending}
                value={picks[choice.group]?.[0] ?? null}
              />
            )}
          </section>
        );
      })}
    </StepForm>
  );
}
