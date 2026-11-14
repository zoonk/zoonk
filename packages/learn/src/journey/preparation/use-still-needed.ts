"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { useExtracted } from "next-intl";
import { type LearnKind } from "../../_components/kind-tile";
import { type Preparation } from "./use-preparation-parts";

const MAX_SHOWN = 2;

export type StillNeededItem = {
  detail: string | null;
  done: boolean;
  key: "memory" | "skills" | "test";
  kind: LearnKind;
  label: string;
};

function useSkillsItem(stillNeeded: ProgressView["stillNeeded"]): StillNeededItem {
  const t = useExtracted();

  return {
    detail: null,
    done: stillNeeded.left === 0,
    key: "skills",
    kind: "lesson",
    label:
      stillNeeded.rule === "examWeighted"
        ? t("Study the topics that count most")
        : t("Keep going with your lessons"),
  };
}

function useMemoryItem(preparation: Preparation): StillNeededItem {
  const t = useExtracted();
  const { fading } = preparation.skills;

  return {
    detail:
      fading === 0
        ? null
        : t(
            "{count, plural, one {# topic, in your next reviews} other {# topics, in your next reviews}}",
            { count: fading },
          ),
    done: fading === 0,
    key: "memory",
    kind: "review",
    label: t("Review what you're starting to forget"),
  };
}

function useTestItem({
  forExam,
  preparation,
}: {
  forExam: boolean;
  preparation: Preparation;
}): StillNeededItem {
  const t = useExtracted();
  const { mocks } = preparation.components;
  const weekly = mocks.kind === "weeklyChallenges";

  const kinds = {
    fullReviews: "practice",
    mockExams: "mock",
    weeklyChallenges: "challenge",
  } as const;

  return {
    detail: forExam && !weekly ? t("Needed to go past 75%") : null,
    done: mocks.taken > 0,
    key: "test",
    kind: kinds[mocks.kind],
    label: {
      fullReviews: t("Review every topic once"),
      mockExams: t("Take your first mock exam"),
      weeklyChallenges: t("Take your first weekly challenge"),
    }[mocks.kind],
  };
}

export function useStillNeeded({
  forExam,
  preparation,
  stillNeeded,
}: {
  forExam: boolean;
  preparation: Preparation;
  stillNeeded: ProgressView["stillNeeded"];
}): StillNeededItem[] {
  const items = [
    useSkillsItem(stillNeeded),
    useMemoryItem(preparation),
    useTestItem({ forExam, preparation }),
  ];

  return items.filter((item) => !item.done).slice(0, MAX_SHOWN);
}
