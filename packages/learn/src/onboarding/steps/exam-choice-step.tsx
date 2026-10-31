"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useChoiceLeftOutLine } from "../../_utils/use-choice-left-out";
import { ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";
import { useAdvanceOnPick } from "./use-advance-on-pick";

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

  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      choices.flatMap((choice) => (choice.subject ? [[choice.group, choice.subject]] : [])),
    ),
  );

  const isComplete = choices.every((choice) => picks[choice.group]);

  const answerWith = (picked: Record<string, string>) =>
    onAnswer({
      choices: choices.flatMap((choice) => {
        const subjectPicked = picked[choice.group];
        return subjectPicked ? [{ group: choice.group, subject: subjectPicked }] : [];
      }),
      question: "examChoice",
      timeZone: getLocalTimeZone(),
    });

  const { cancel, pick, submit } = useAdvanceOnPick({ answer: answerWith, pending });
  const [only] = choices;

  return (
    <StepForm
      canContinue={isComplete}
      description={
        choices.length === 1 && only
          ? t({
              description:
                "{group} is the notice's name for one of the exam's choices, such as a specialty or the foreign language, which comes from the notice in its own language",
              message:
                "The exam offers {count, plural, one {# option} other {# options}} for {group}. Your plan and mocks follow the one you pick, and you can change it in your plan.",
              values: { count: only.options.length, group: only.group },
            })
          : t(
              "The exam has {count, plural, one {# choice} other {# choices}} to make. Your plan and mocks follow your picks, and you can change them in your plan.",
              { count: choices.length },
            )
      }
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
        { count: choices.length },
      )}
    >
      {choices.map((choice, index) => (
        <section className="flex flex-col gap-2" key={choice.group}>
          <h2 className="text-muted-foreground text-sm font-medium">{choice.group}</h2>

          <ChoiceList
            choices={choice.options.map((option) => ({
              description:
                option.shortName && option.shortName !== option.name ? option.name : undefined,
              label: option.shortName ?? option.name,
              value: option.name,
            }))}
            label={choice.group}
            numberKeys={index === 0}
            onChange={(value) => setPicks({ ...picks, [choice.group]: value })}
            onPick={
              choices.length === 1
                ? (value) => pick({ ...picks, [choice.group]: value })
                : undefined
            }
            readOnly={pending}
            value={picks[choice.group] ?? null}
          />

          <p className="text-muted-foreground text-sm">{leftOutLine(choice)}</p>
        </section>
      ))}
    </StepForm>
  );
}
