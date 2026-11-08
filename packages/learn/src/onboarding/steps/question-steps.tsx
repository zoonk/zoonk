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
      description: t("A short course: the big ideas, no formulas"),
      label: t("Get an overview"),
      value: "overview",
    },
    {
      description: t("The full path, from the basics to advanced"),
      label: t("Understand it in depth"),
      value: "deep",
    },
    {
      description: t("Only what your work uses, in the order it needs"),
      label: t("Use it at work"),
      value: "work",
    },
    {
      description: t("What the new role needs, portfolio included"),
      label: t("Change careers"),
      value: "careerChange",
    },
    {
      description: t("Back to the level you had, after a quick test"),
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
      description={t("It sets how deep your course goes, and so how long it is.")}
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
      description={t("It only changes where your plan starts.")}
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

  const copy: Record<
    ExamTarget,
    Record<"description" | "label" | "title", string> & { placeholder?: string }
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
      title: t("Which position are you applying for?"),
    },
    score: {
      description: t("It helps your plan focus on what counts most."),
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
      description={copy.description}
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
