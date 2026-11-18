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
      description: t("I want a quick look at the big ideas"),
      label: t("Get an overview"),
      value: "overview",
    },
    {
      description: t("I want to go from the basics to advanced topics"),
      label: t("Understand it well"),
      value: "deep",
    },
    {
      description: t("I want to learn what I use at work"),
      label: t("Use it at work"),
      value: "work",
    },
    {
      description: t("I want to learn what I need for a new role and build a portfolio"),
      label: t("Change careers"),
      value: "careerChange",
    },
    {
      description: t("I want to get back to the level I had"),
      label: t("Refresh what I studied"),
      value: "refresh",
    },
    { description: t("I want something different"), label: t("Something else"), value: "other" },
  ];

  return (
    <StepForm
      canContinue={purpose !== null}
      subject={subject}
      onContinue={() => purpose && submit(purpose)}
      pending={pending}
      title={t({
        description: "Asks what the learner hopes to get out of learning this subject.",
        message: "What do you want from it?",
      })}
    >
      <ChoiceList
        choices={choices}
        label={t({
          description: "Asks what the learner hopes to get out of learning this subject.",
          message: "What you want from it",
        })}
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
  testMinutes,
}: StepProps & { initialLevel?: LevelChoice | null; testMinutes: number }) {
  const t = useExtracted();
  const [level, setLevel] = useState<LevelChoice | null>(initialLevel);

  const { pick, submit } = useAdvanceOnPick({
    answer: (picked: LevelChoice) => onAnswer({ level: toLevelAnswer(picked), question: "level" }),
    pending,
  });

  return (
    <StepForm
      canContinue={level !== null}
      subject={subject}
      onContinue={() => level && submit(level)}
      pending={pending}
      title={t("How much do you already know?")}
    >
      <LevelChoiceList
        onChange={setLevel}
        onPick={pick}
        readOnly={pending}
        testMinutes={testMinutes}
        value={level}
      />
    </StepForm>
  );
}

export type ExamTarget = "admission" | "position" | "score";

function toTextAnswer(value: string | null): OnboardingAnswerInput {
  return { question: "target", target: value };
}

function useExamTargetCopy(question: ExamTarget) {
  const t = useExtracted();

  const copy: Record<ExamTarget, Record<"label" | "title", string> & { placeholder?: string }> = {
    admission: {
      label: t("Your target"),
      placeholder: t("E.g., medicine, 750 points"),
      title: t("Which course and score are you aiming for?"),
    },
    position: { label: t("Position"), title: t("Which position are you applying for?") },
    score: {
      label: t("Your target"),
      placeholder: t({
        description: "An example score: a band is an IELTS-style score.",
        message: "E.g., band 7, 100 points",
      }),
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
}: StepProps & { question: ExamTarget }) {
  const copy = useExamTargetCopy(question);
  const [value, setValue] = useState("");

  return (
    <StepForm
      canContinue={value.trim().length > 0}
      onContinue={() => onAnswer(toTextAnswer(value.trim()))}
      onSkip={() => onAnswer(toTextAnswer(null))}
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
      canContinue={answers.some((answer) => answer.trim().length > 0)}
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
