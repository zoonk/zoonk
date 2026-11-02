"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useChoiceLeftOutLine } from "../../_utils/use-choice-left-out";
import { CheckList, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";
import { useAdvanceOnPick } from "./use-advance-on-pick";

type Picks = Record<string, string[]>;

function useDescription(choices: ExamChoiceView[]): string {
  const t = useExtracted();
  const [only] = choices;

  if (choices.length !== 1 || !only) {
    return t(
      "The exam has {count, plural, one {# choice} other {# choices}} to make. Your plan and mocks follow your picks, and you can change them in your plan.",
      { count: choices.length },
    );
  }

  if (only.take > 1) {
    return t({
      description:
        "{group} is the notice's name for one of the exam's choices, such as the modules a course takes, which comes from the notice in its own language. {take} is how many of the options the exam's rules give each candidate",
      message:
        "The exam offers {count, plural, one {# option} other {# options}} for {group}, and each candidate takes {take, number} of them. Your plan and mocks follow the ones you pick, and you can change them in your plan.",
      values: { count: only.options.length, group: only.group, take: only.take },
    });
  }

  return t({
    description:
      "{group} is the notice's name for one of the exam's choices, such as a specialty or the foreign language, which comes from the notice in its own language",
    message:
      "The exam offers {count, plural, one {# option} other {# options}} for {group}. Your plan and mocks follow the one you pick, and you can change it in your plan.",
    values: { count: only.options.length, group: only.group },
  });
}

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
  const leftOutLine = useChoiceLeftOutLine();
  const description = useDescription(choices);

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
      description={description}
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
            <h2 className="text-muted-foreground text-sm font-medium">{choice.group}</h2>

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

            <p className="text-muted-foreground text-sm">{leftOutLine(choice)}</p>
          </section>
        );
      })}
    </StepForm>
  );
}
