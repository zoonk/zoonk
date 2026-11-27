"use client";

import { type OnboardingOwnLevel } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../../_utils/time-format";
import { readOwnLevel } from "../_utils/setup-level";
import { type Choice, ChoiceList } from "../choice-list";

const QUICK_TEST = "test";

export type LevelChoice = OnboardingOwnLevel | typeof QUICK_TEST;

/** A learner who isn't sure asks for the test, so it opens without being offered again. */
export function toLevelAnswer(
  choice: LevelChoice,
): { level: OnboardingOwnLevel } | { level: null; requestPlacement: true } {
  return choice === QUICK_TEST ? { level: null, requestPlacement: true } : { level: choice };
}

export function readLevelChoice(details: Record<string, unknown>): LevelChoice | null {
  const own = readOwnLevel(details);

  if (own) {
    return own;
  }

  return Array.isArray(details.answered) && details.answered.includes("level") ? QUICK_TEST : null;
}

export function useOwnLevelLabels(): Record<OnboardingOwnLevel, string> {
  const t = useExtracted();

  return {
    advanced: t("I know it well"),
    basic: t({
      description: "An answer to how much the learner already knows about the topic.",
      message: "The basics",
    }),
    intermediate: t("I studied it before"),
    none: t("Nothing, I'm just starting"),
  };
}

export function LevelChoiceList({
  onChange,
  readOnly,
  testMinutes,
  value,
}: {
  onChange: (value: LevelChoice) => void;
  readOnly?: boolean;
  testMinutes: number;
  value: LevelChoice | null;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const labels = useOwnLevelLabels();

  const choices: Choice<LevelChoice>[] = [
    { description: t("From scratch, with everyday examples"), label: labels.none, value: "none" },
    { description: t("I know a few things"), label: labels.basic, value: "basic" },
    {
      description: t("Skip what I already know"),
      label: labels.intermediate,
      value: "intermediate",
    },
    { description: t("Only what's new or hard"), label: labels.advanced, value: "advanced" },
    {
      description: t("About {time}", { time: formatDuration(testMinutes) }),
      label: t("Not sure, give me a short test"),
      value: QUICK_TEST,
    },
  ];

  return (
    <ChoiceList
      choices={choices}
      label={t("Your level")}
      onChange={onChange}
      readOnly={readOnly}
      value={value}
    />
  );
}
