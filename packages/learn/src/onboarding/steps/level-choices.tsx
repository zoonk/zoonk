"use client";

import { type OnboardingOwnLevel } from "@zoonk/core/view-models/onboarding/contract";
import {
  GraduationCapIcon,
  LayersIcon,
  SchoolIcon,
  SproutIcon,
  TestTubeDiagonalIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { type Choice, ChoiceList } from "../choice-list";

/** "Not sure" still counts as an answer: placement finds the level instead. */
const QUICK_TEST = "test";

export type LevelChoice = OnboardingOwnLevel | typeof QUICK_TEST;

const OWN_LEVELS: readonly OnboardingOwnLevel[] = ["advanced", "basic", "intermediate", "none"];

function isOwnLevel(value: unknown): value is OnboardingOwnLevel {
  return OWN_LEVELS.some((level) => level === value);
}

/** The level a choice answers: a quick test leaves it to placement. */
export function toLevelAnswer(choice: LevelChoice): OnboardingOwnLevel | null {
  return choice === QUICK_TEST ? null : choice;
}

/**
 * The pick the learner made before, as the goal saved it, so Back shows it: their level, or the
 * quick test when they answered without one. Null before they answered.
 */
export function readLevelChoice(details: Record<string, unknown>): LevelChoice | null {
  const { answered, level } = details;

  if (isOwnLevel(level)) {
    return level;
  }

  return Array.isArray(answered) && answered.includes("level") ? QUICK_TEST : null;
}

/**
 * "How much do you already know?": the learner's level, or a quick test that finds it. Asked on
 * onboarding's level screen and on a course's start page, before anything is created.
 */
export function LevelChoiceList({
  onChange,
  value,
}: {
  onChange: (value: LevelChoice) => void;
  value: LevelChoice | null;
}) {
  const t = useExtracted();

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

  return <ChoiceList choices={choices} label={t("Your level")} onChange={onChange} value={value} />;
}
