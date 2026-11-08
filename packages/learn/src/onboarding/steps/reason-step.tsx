"use client";

import { type LanguageReason, type LanguageReasonView } from "@zoonk/core/language/aims";
import { type OnboardingAnswerInput } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { type Choice, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";
import { TextField } from "./text-field";
import { useAdvanceOnPick } from "./use-advance-on-pick";

function asksWords(reason: LanguageReason | null): boolean {
  return reason === "certificate" || reason === "other";
}

function ReasonSize({ view }: { view: LanguageReasonView }) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <span className="flex shrink-0 flex-col items-end justify-center gap-0.5 self-center font-mono text-xs tabular-nums">
      {view.aim ? (
        <>
          <span className="text-foreground font-medium">{view.aim}</span>
          {view.hours !== null && (
            <span className="text-muted-foreground">
              {t({
                description: 'Hours of study, as a short figure like "190 h".',
                message: "{hours} h",
                values: { hours: format.number(view.hours) },
              })}
            </span>
          )}
        </>
      ) : (
        <span className="text-foreground font-medium">
          {t({
            description: "Beside a language goal's reason: a certificate's plan follows its exam.",
            message: "Exam",
          })}
        </span>
      )}
    </span>
  );
}

function useReasonCopy() {
  const t = useExtracted();

  return (view: LanguageReasonView): Pick<Choice<LanguageReason>, "description" | "label"> => {
    switch (view.reason) {
      case "travel":
        return {
          description: t("Get by on trips: order, ask the way, small talk"),
          label: t({ description: "A reason to learn a language: to travel.", message: "Travel" }),
        };
      case "talk":
        return {
          description: t("Everyday conversations, at home or abroad"),
          label: t("Talk with people"),
        };
      case "work":
        return {
          description: t("Meetings, interviews and classes"),
          label: t("Work or study in it"),
        };
      case "fluent":
        return {
          description: t("Talk about almost anything with ease"),
          label: t("Speak it fluently"),
        };
      case "certificate":
        return { description: t("IELTS, DELE, CELI and others"), label: t("Pass a certificate") };
      case "other":
        return {
          description: t("In your own words. Aims for {level}", { level: view.aim ?? "" }),
          label: t("Something else"),
        };
      default:
        return view.reason satisfies never;
    }
  };
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

  return reason === "certificate" ? (
    <div className="flex flex-col gap-2 py-3 pl-8">
      <TextField label={t("Which one?")} onChange={onChange} onKeyDown={keepKeys} value={value} />
      <p className="text-muted-foreground text-sm">
        {t("Your plan follows that exam's papers and score.")}
      </p>
    </div>
  ) : (
    <div className="py-3 pl-8">
      <TextField
        label={t("In your own words")}
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
      description={t("Your answer sets how far your course goes.")}
      onContinue={() => reason && submit(reason)}
      pending={pending}
      subject={subject}
      title={t("Why are you learning it?")}
    >
      <div className="flex flex-col gap-3">
        <ChoiceList
          choices={choices}
          label={t("Why you're learning it")}
          onChange={setReason}
          onPick={(picked) => (asksWords(picked) ? cancel() : pick(picked))}
          readOnly={pending}
          value={reason}
        />

        <p className="text-muted-foreground text-sm text-pretty">
          {t("Hours of study from scratch, practice included. Less if you already know some.")}
        </p>
      </div>
    </StepForm>
  );
}
