"use client";

import {
  type OnboardingAnswerInput,
  type OnboardingPurpose,
} from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type Choice, ChoiceList } from "../choice-list";
import { type LevelChoice, LevelChoiceList, toLevelAnswer } from "./level-choices";
import { StepForm } from "./step-form";
import { TextField } from "./text-field";
import { useAdvanceOnPick } from "./use-advance-on-pick";

type StepProps = {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  subject: string;
};

export function PurposeStep({ onAnswer, pending, subject }: StepProps) {
  const t = useExtracted();
  const [purpose, setPurpose] = useState<OnboardingPurpose | null>(null);

  const { pick, submit } = useAdvanceOnPick({
    answer: (picked: OnboardingPurpose) => onAnswer({ purpose: picked, question: "purpose" }),
    pending,
  });

  const choices: Choice<OnboardingPurpose>[] = [
    {
      description: t("The big ideas, no formulas"),
      label: t("Get an overview"),
      value: "overview",
    },
    {
      description: t("From the basics to advanced"),
      label: t("Understand it in depth"),
      value: "deep",
    },
    { description: t("Apply it to real projects"), label: t("Use it at work"), value: "work" },
    {
      description: t("Get ready for a new role"),
      label: t("Change careers"),
      value: "careerChange",
    },
    {
      description: t("Pick up what you left behind"),
      label: t("Refresh what I studied"),
      value: "refresh",
    },
    {
      description: t("Tell us later, in your own words"),
      label: t("Something else"),
      value: "other",
    },
  ];

  return (
    <StepForm
      canContinue={purpose !== null}
      description={t("Pick what motivates you most.")}
      subject={subject}
      onContinue={() => purpose && submit(purpose)}
      pending={pending}
      title={t("What do you want from it?")}
    >
      <ChoiceList
        choices={choices}
        label={t("What you want from it")}
        onChange={setPurpose}
        onPick={pick}
        readOnly={pending}
        value={purpose}
      />
    </StepForm>
  );
}

export function LevelStep({
  initialLevel = null,
  onAnswer,
  pending,
  subject,
}: StepProps & { initialLevel?: LevelChoice | null }) {
  const t = useExtracted();
  const [level, setLevel] = useState<LevelChoice | null>(initialLevel);

  const { pick, submit } = useAdvanceOnPick({
    answer: (picked: LevelChoice) => onAnswer({ level: toLevelAnswer(picked), question: "level" }),
    pending,
  });

  return (
    <StepForm
      canContinue={level !== null}
      description={t("It only changes where your plan starts.")}
      subject={subject}
      onContinue={() => level && submit(level)}
      pending={pending}
      title={t("How much do you already know?")}
    >
      <LevelChoiceList onChange={setLevel} onPick={pick} readOnly={pending} value={level} />
    </StepForm>
  );
}

export type ExamTarget = "admission" | "position" | "score";

type TextQuestion = ExamTarget | "reason";

function toTextAnswer({
  question,
  value,
}: {
  question: TextQuestion;
  value: string | null;
}): OnboardingAnswerInput {
  return question === "reason"
    ? { question, reason: value }
    : { question: "target", target: value };
}

function useTextQuestionCopy(question: TextQuestion) {
  const t = useExtracted();

  const copy: Record<
    TextQuestion,
    Record<"description" | "label" | "placeholder" | "title", string>
  > = {
    admission: {
      description: t("It helps your plan focus on what counts most."),
      label: t("Your target"),
      placeholder: t("E.g., medicine, 750 points"),
      title: t("Which course and score are you aiming for?"),
    },
    position: {
      description: t("The notice can have a different exam for each position."),
      label: t("Position"),
      placeholder: t("E.g., agente, analista"),
      title: t("Which position are you applying for?"),
    },
    reason: {
      description: t("The situations you care about shape every lesson."),
      label: t("Why"),
      placeholder: t("E.g., a job interview, travel"),
      title: t("Why are you learning it?"),
    },
    score: {
      description: t("It helps your plan focus on what counts most."),
      label: t("Your target"),
      placeholder: t("E.g., band 7, 100 points"),
      title: t("What score do you need?"),
    },
  };

  return copy[question];
}

export function TextStep({
  onAnswer,
  pending,
  question,
  subject,
}: StepProps & { question: TextQuestion }) {
  const copy = useTextQuestionCopy(question);
  const [value, setValue] = useState("");

  return (
    <StepForm
      canContinue={value.trim().length > 0}
      description={copy.description}
      onContinue={() => onAnswer(toTextAnswer({ question, value: value.trim() }))}
      onSkip={() => onAnswer(toTextAnswer({ question, value: null }))}
      pending={pending}
      subject={subject}
      title={copy.title}
    >
      <TextField
        label={copy.label}
        onChange={setValue}
        placeholder={copy.placeholder}
        value={value}
      />
    </StepForm>
  );
}

export function FollowUpsStep({
  onAnswer,
  pending,
  questions,
}: Omit<StepProps, "subject"> & { questions: string[] }) {
  const t = useExtracted();
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ""));

  return (
    <StepForm
      description={t("A couple of details make your plan fit better.")}
      onContinue={() =>
        onAnswer({ answers: answers.map((answer) => answer.trim() || null), question: "followUps" })
      }
      onSkip={() => onAnswer({ answers: questions.map(() => null), question: "followUps" })}
      pending={pending}
      title={t("Tell us a bit more")}
    >
      {questions.map((question, index) => (
        <TextField
          autoFocus={index === 0}
          key={question}
          label={question}
          // From the answers as they are by then: two fields' kept words come in at once.
          onChange={(value) =>
            setAnswers((current) =>
              current.map((answer, position) => (position === index ? value : answer)),
            )
          }
          placeholder={t("Your answer")}
          value={answers[index] ?? ""}
        />
      ))}
    </StepForm>
  );
}
