"use client";

import {
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireTitle,
} from "@zoonk/ui/components/questionnaire";
import { useExtracted } from "next-intl";

type QuestionProps = { disabled: boolean; onChange: (value: string) => void; value: string };

const COURSE_GOAL_ID = "course-learning-goal";
const COURSE_GOAL_DETAIL_TITLE_ID = "course-goal-detail-title";

export function CoreStartingPoint({ disabled, onChange, value }: QuestionProps) {
  const t = useExtracted();

  const choices = [
    {
      description: t("Start with clear, everyday explanations."),
      title: t("I'm new to this"),
      value: "basic",
    },
    {
      description: t("Build on the ideas I already know."),
      title: t("I know the basics"),
      value: "intermediate",
    },
    {
      description: t("Explore more advanced ideas and applications."),
      title: t("I use it confidently"),
      value: "advanced",
    },
    {
      description: t("Start with the basics. You can move ahead anytime."),
      title: t("I'm not sure"),
      value: "unsure",
    },
  ];

  return (
    <QuestionnaireItem name="startingLevel" required>
      <QuestionnaireTitle className="text-2xl tracking-tight">
        {t("How familiar are you with this subject?")}
      </QuestionnaireTitle>
      <QuestionnaireDescription>
        {t("Choose a comfortable starting point. You can change it later.")}
      </QuestionnaireDescription>
      <QuestionnaireChoices>
        {choices.map((choice) => (
          <QuestionnaireChoice
            checked={value === choice.value}
            disabled={disabled}
            key={choice.value}
            onChange={() => onChange(choice.value)}
            value={choice.value}
          >
            <span className="font-medium">{choice.title}</span>
            <QuestionnaireChoiceDescription>{choice.description}</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
        ))}
      </QuestionnaireChoices>
      {!disabled && (
        <QuestionnaireError>{t("Choose a starting point to continue.")}</QuestionnaireError>
      )}
    </QuestionnaireItem>
  );
}

export function LanguageStartingPoint({ disabled, onChange, value }: QuestionProps) {
  const t = useExtracted();

  const choices = [
    {
      description: t("Everyday words and simple introductions."),
      title: t("A1 · Getting started"),
      value: "a1",
    },
    {
      description: t("Simple conversations about familiar things."),
      title: t("A2 · Everyday basics"),
      value: "a2",
    },
    {
      description: t("Handle common situations and share experiences."),
      title: t("B1 · Independent conversations"),
      value: "b1",
    },
    {
      description: t("Discuss ideas and follow more detailed conversations."),
      title: t("B2 · Confident conversations"),
      value: "b2",
    },
    {
      description: t("Express complex ideas clearly and flexibly."),
      title: t("C1 · Advanced language"),
      value: "c1",
    },
    {
      description: t("Understand nuance and communicate with precision."),
      title: t("C2 · Precise expression"),
      value: "c2",
    },
    {
      description: t("Try A1. You can choose another level anytime."),
      title: t("I'm not sure"),
      value: "unsure",
    },
  ];

  return (
    <QuestionnaireItem name="startingLevel" required>
      <QuestionnaireTitle className="text-2xl tracking-tight">
        {t("Where would you like to begin?")}
      </QuestionnaireTitle>
      <QuestionnaireDescription>
        {t("These levels describe what you'll study. Choose the one that feels right for you.")}
      </QuestionnaireDescription>
      <QuestionnaireChoices className="gap-2">
        {choices.map((choice) => (
          <QuestionnaireChoice
            checked={value === choice.value}
            disabled={disabled}
            key={choice.value}
            onChange={() => onChange(choice.value)}
            value={choice.value}
          >
            <span className="font-medium">{choice.title}</span>
            <QuestionnaireChoiceDescription>{choice.description}</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
        ))}
      </QuestionnaireChoices>
      {!disabled && <QuestionnaireError>{t("Choose a level to continue.")}</QuestionnaireError>}
    </QuestionnaireItem>
  );
}

export function CourseLearningGoal({ disabled, onChange, value }: QuestionProps) {
  const t = useExtracted();

  const choices = [
    {
      description: t("Focus on useful skills and practical decisions."),
      title: t("Use it at work"),
      value: "work",
    },
    {
      description: t("Learn by turning an idea into a project."),
      title: t("Make something"),
      value: "project",
    },
    {
      description: t("Understand the foundations and how ideas connect."),
      title: t("Prepare for further study"),
      value: "study",
    },
  ];

  const isSuggestedGoal = choices.some((choice) => choice.value === value);

  return (
    <QuestionnaireItem name="goal" required>
      <QuestionnaireTitle className="text-2xl tracking-tight">
        {t("What would you like to be able to do?")}
      </QuestionnaireTitle>
      <QuestionnaireDescription>
        {t(
          "We'll choose chapters that help you get there. Include anything you already know or want to skip.",
        )}
      </QuestionnaireDescription>
      <QuestionnaireChoices>
        {choices.map((choice) => (
          <QuestionnaireChoice
            checked={value === choice.value}
            disabled={disabled}
            key={choice.value}
            onChange={() => onChange(choice.value)}
            value={choice.value}
          >
            <span className="font-medium">{choice.title}</span>
            <QuestionnaireChoiceDescription>{choice.description}</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
        ))}
        <label className="text-sm font-medium" htmlFor={COURSE_GOAL_ID}>
          {t("Another goal")}
        </label>
        <QuestionnaireInput
          disabled={disabled}
          id={COURSE_GOAL_ID}
          maxLength={4000}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("Describe what you want to do…")}
          value={isSuggestedGoal ? "" : value}
        />
      </QuestionnaireChoices>
      {!disabled && (
        <QuestionnaireError>{t("Choose a goal or describe your own.")}</QuestionnaireError>
      )}
    </QuestionnaireItem>
  );
}

export function CourseGoalDetail({
  disabled,
  goal,
  onChange,
  value,
}: QuestionProps & { goal: string }) {
  const t = useExtracted();

  return (
    <QuestionnaireItem name="goalDetail" required>
      <QuestionnaireTitle className="text-2xl tracking-tight" id={COURSE_GOAL_DETAIL_TITLE_ID}>
        <CourseGoalDetailTitle goal={goal} />
      </QuestionnaireTitle>
      <QuestionnaireDescription>
        {t(
          "A little detail helps us choose useful chapters. Include anything you already know or want to skip.",
        )}
      </QuestionnaireDescription>
      <QuestionnaireInput
        aria-labelledby={COURSE_GOAL_DETAIL_TITLE_ID}
        disabled={disabled}
        maxLength={3500}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("Tell us what you have in mind…")}
        value={value}
      />
      {!disabled && <QuestionnaireError>{t("Describe your goal to continue.")}</QuestionnaireError>}
    </QuestionnaireItem>
  );
}

function CourseGoalDetailTitle({ goal }: { goal: string }) {
  const t = useExtracted();

  if (goal === "work") {
    return t("What will you use this for at work?");
  }

  if (goal === "project") {
    return t("What would you like to make?");
  }

  return t("What would you like to study next?");
}
