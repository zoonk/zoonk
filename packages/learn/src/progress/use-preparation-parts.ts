"use client";

import { useExtracted } from "next-intl";
import { usePreparation } from "./progress-context";

type PreparationPart = {
  /** The evidence behind the number, in plain words. */
  evidence: string;
  key: "coverage" | "mastery" | "mocks" | "retention";
  label: string;
  /** Null until there's something to measure: an honest blank, never a made-up number. */
  value: number | null;
};

/**
 * The four parts of Preparation with their evidence, the same in both modes: coverage of the
 * goal's skills, mastery on questions never seen, memory over time, and an exam's mock exams or
 * another goal's weekly challenges.
 */
export function usePreparationParts(): PreparationPart[] {
  const t = useExtracted();

  const mockEvidence = (taken: number) =>
    taken === 0
      ? t("No mock exams yet")
      : t("{count, plural, one {# mock exam taken} other {# mock exams taken}}", { count: taken });

  const weeklyEvidence = (taken: number) =>
    taken === 0
      ? t("Your score on the weekly challenges. Shows after the first one.")
      : t("Your last {count, plural, one {weekly challenge} other {# weekly challenges}}", {
          count: taken,
        });

  const { coverage, mastery, mocks, retention } = usePreparation().components;
  const isWeekly = mocks.kind === "weeklyChallenges";

  return [
    {
      evidence: t(
        "{total, plural, one {{studied, number} of # skill studied} other {{studied, number} of # skills studied}}",
        { studied: coverage.studiedSkills, total: coverage.totalSkills },
      ),
      key: "coverage",
      label: t("Coverage"),
      value: coverage.value,
    },
    {
      evidence:
        mastery.value === null
          ? t("Right on questions you've never seen. Shows after a few of them.")
          : t("{correct, number} of {answered, number} right on questions you'd never seen", {
              answered: mastery.answered,
              correct: mastery.correct,
            }),
      key: "mastery",
      label: t("Mastery"),
      value: mastery.value,
    },
    {
      evidence:
        retention.value === null
          ? t("How much of what you studied you still remember. Shows after your first reviews.")
          : t("Of what you've studied is still remembered"),
      key: "retention",
      // Not "Memory": that's the settings feature (what Zoonk remembers about you), and the same
      // English shares one translation across the app.
      label: t("Long-term memory"),
      value: retention.value,
    },
    {
      evidence: isWeekly ? weeklyEvidence(mocks.taken) : mockEvidence(mocks.taken),
      key: "mocks",
      label: isWeekly ? t("Weekly challenges") : t("Mock exams"),
      value: mocks.value,
    },
  ];
}
