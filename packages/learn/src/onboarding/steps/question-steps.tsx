"use client";

import {
  type OnboardingAnswerInput,
  type OnboardingOwnLevel,
  type OnboardingPurpose,
} from "@zoonk/core/view-models/onboarding/contract";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import {
  BriefcaseBusinessIcon,
  GraduationCapIcon,
  HistoryIcon,
  LayersIcon,
  PencilLineIcon,
  RouteIcon,
  SchoolIcon,
  SproutIcon,
  TelescopeIcon,
  TestTubeDiagonalIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { type Choice, ChoiceList } from "../choice-list";
import { StepForm } from "./step-form";
import { TextField } from "./text-field";

type StepProps = {
  onAnswer: (input: OnboardingAnswerInput) => void;
  pending: boolean;
  subject: string;
};

/** Learn goals: an overview and a deep dive make very different plans. */
export function PurposeStep({ onAnswer, pending, subject }: StepProps) {
  const t = useExtracted();
  const [purpose, setPurpose] = useState<OnboardingPurpose | null>(null);

  const choices: Choice<OnboardingPurpose>[] = [
    {
      description: t("The big ideas, no formulas"),
      icon: <TelescopeIcon />,
      label: t("Get an overview"),
      value: "overview",
    },
    {
      description: t("From the basics to advanced"),
      icon: <LayersIcon />,
      label: t("Understand it in depth"),
      value: "deep",
    },
    {
      description: t("Apply it to real projects"),
      icon: <BriefcaseBusinessIcon />,
      label: t("Use it at work"),
      value: "work",
    },
    {
      description: t("Get ready for a new role"),
      icon: <RouteIcon />,
      label: t("Change careers"),
      value: "careerChange",
    },
    {
      description: t("Pick up what you left behind"),
      icon: <HistoryIcon />,
      label: t("Refresh what I studied"),
      value: "refresh",
    },
    {
      description: t("Tell us later, in your own words"),
      icon: <PencilLineIcon />,
      label: t("Something else"),
      value: "other",
    },
  ];

  return (
    <StepForm
      canContinue={purpose !== null}
      description={t("Pick what motivates you most.")}
      subject={subject}
      onContinue={() => purpose && onAnswer({ purpose, question: "purpose" })}
      pending={pending}
      title={t("What do you want from it?")}
    >
      <ChoiceList
        choices={choices}
        label={t("What you want from it")}
        onChange={setPurpose}
        value={purpose}
      />
    </StepForm>
  );
}

/** "Not sure" still counts as an answer: placement finds the level instead. */
const QUICK_TEST = "test";

type LevelChoice = OnboardingOwnLevel | typeof QUICK_TEST;

export function LevelStep({ onAnswer, pending, subject }: StepProps) {
  const t = useExtracted();
  const [level, setLevel] = useState<LevelChoice | null>(null);

  const choices: Choice<LevelChoice>[] = [
    {
      description: t("From scratch, with everyday examples"),
      icon: <SproutIcon />,
      label: t("Nothing, I'm just starting"),
      value: "none",
    },
    {
      description: t("I know a few things"),
      icon: <SchoolIcon />,
      label: t("The basics"),
      value: "basic",
    },
    {
      description: t("We'll skip what you already know"),
      icon: <GraduationCapIcon />,
      label: t("I studied it before"),
      value: "intermediate",
    },
    {
      description: t("Only what's new or hard"),
      icon: <LayersIcon />,
      label: t("I know it well"),
      value: "advanced",
    },
    {
      description: t("Adapts to your answers, about 2 min"),
      icon: <TestTubeDiagonalIcon />,
      label: t("Not sure, give me a quick test"),
      value: QUICK_TEST,
    },
  ];

  return (
    <StepForm
      canContinue={level !== null}
      description={t(
        "Answer honestly. Nobody is grading you. This changes where we start, not what you can learn.",
      )}
      subject={subject}
      onContinue={() =>
        level && onAnswer({ level: level === QUICK_TEST ? null : level, question: "level" })
      }
      pending={pending}
      title={t("How much do you already know?")}
    >
      <ChoiceList choices={choices} label={t("Your level")} onChange={setLevel} value={level} />
    </StepForm>
  );
}

type TextQuestion = "reason" | "target";

function toTextAnswer({
  question,
  value,
}: {
  question: TextQuestion;
  value: string | null;
}): OnboardingAnswerInput {
  switch (question) {
    case "reason":
      return { question, reason: value };
    case "target":
      return { question, target: value };
    default:
      return { question, target: value };
  }
}

function useTextQuestionCopy(question: TextQuestion) {
  const t = useExtracted();

  const copy: Record<
    TextQuestion,
    Record<"description" | "label" | "placeholder" | "title", string>
  > = {
    reason: {
      description: t("The situations you care about shape every lesson."),
      label: t("Why"),
      placeholder: t("E.g., a job interview, travel"),
      title: t("Why are you learning it?"),
    },
    target: {
      description: t("It's your target. We help you prepare; nobody can promise a result."),
      label: t("Your target"),
      placeholder: t("A score, a course or a position"),
      title: t("What are you aiming for?"),
    },
  };

  return copy[question];
}

/** A short answer in the learner's words, or skip it. */
export function TextStep({
  onAnswer,
  pending,
  question,
}: Omit<StepProps, "subject"> & { question: TextQuestion }) {
  const copy = useTextQuestionCopy(question);
  const [value, setValue] = useState("");

  return (
    <StepForm
      canContinue={value.trim().length > 0}
      description={copy.description}
      onContinue={() => onAnswer(toTextAnswer({ question, value: value.trim() }))}
      onSkip={() => onAnswer(toTextAnswer({ question, value: null }))}
      pending={pending}
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

/** Questions asked about an unusual goal, answered together on one screen. */
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
          onChange={(value) =>
            setAnswers(answers.map((answer, position) => (position === index ? value : answer)))
          }
          placeholder={t("Your answer")}
          value={answers[index] ?? ""}
        />
      ))}
    </StepForm>
  );
}

/** A deadline is optional: without one, the plan shows when each milestone arrives. */
export function DateStep({ onAnswer, pending }: Omit<StepProps, "subject">) {
  const t = useExtracted();
  const inputId = useId();
  const [date, setDate] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <StepForm
      canContinue={date > today}
      description={t("Without a date, we'll show when you reach each milestone at your pace.")}
      onContinue={() => onAnswer({ question: "targetDate", targetDate: date })}
      onSkip={() => onAnswer({ question: "targetDate", targetDate: null })}
      pending={pending}
      skipLabel={t("No date")}
      title={t("Is there a date you're aiming for?")}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t("Date")}</Label>
        <Input
          className="in-data-[mode=fun]:fun-glass h-12 text-base"
          id={inputId}
          min={today}
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
      </div>
    </StepForm>
  );
}
