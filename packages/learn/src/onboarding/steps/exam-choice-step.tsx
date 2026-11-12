"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { CheckList, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";
import { useAdvanceOnPick } from "./use-advance-on-pick";

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

  const { cancel, pick, submit } = useAdvanceOnPick({ answer: answerWith, pending });

  return (
    <StepForm
      canContinue={isComplete}
      onContinue={() => submit(picks)}
      onSkip={() => {
        cancel();
        onAnswer({ choices: null, question: "examChoice" });
      }}
      pending={pending}
      skipLabel={t("Decide later")}
      subject={subject}
      title={t(
        "{count, plural, one {Which one will you take?} other {Which ones will you take?}}",
        { count: takes },
      )}
    >
      {choices.map((choice, index) => {
        const options = choice.options.map((option) => ({
          description:
            option.shortName && option.shortName !== option.name ? option.name : undefined,
          label: option.shortName ?? option.name,
          value: option.name,
        }));

        return (
          <section className="flex flex-col gap-2" key={choice.group}>
            <h2 className="text-sm font-medium">{choice.group}</h2>

            {choice.take > 1 ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {t("Pick up to {take, number}.", { take: choice.take })}
                </p>

                <CheckList
                  choices={options}
                  label={choice.group}
                  max={choice.take}
                  onChange={(names) => setPicks({ ...picks, [choice.group]: names })}
                  readOnly={pending}
                  value={picks[choice.group] ?? []}
                />
              </>
            ) : (
              <ChoiceList
                choices={options}
                label={choice.group}
                numberKeys={index === 0}
                onChange={(value) => setPicks({ ...picks, [choice.group]: [value] })}
                onPick={
                  takes === 1 ? (value) => pick({ ...picks, [choice.group]: [value] }) : undefined
                }
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
