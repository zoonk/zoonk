"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { useExtracted } from "next-intl";
import { type LearnKind } from "../../_components/kind-tile";
import { useFormatDuration } from "../../_utils/time-format";
import { type Preparation } from "./use-preparation-parts";

const MAX_SHOWN = 2;

const MINUTES_PER_HOUR = 60;

const WHOLE_HOURS_FROM_MINUTES = 2 * MINUTES_PER_HOUR;

function roundEstimate(minutes: number): number {
  return minutes < WHOLE_HOURS_FROM_MINUTES
    ? minutes
    : Math.round(minutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
}

export type StillNeededItem = {
  detail: string | null;
  done: boolean;
  key: "memory" | "skills" | "test";
  kind: LearnKind;
  label: string;
  plusRequired: boolean;
};

/** No count: beside Coverage's "3 of 35", a "29 to go" read as a contradiction. */
function useSkillsItem(stillNeeded: ProgressView["stillNeeded"]): StillNeededItem {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { left, minutes, rule } = stillNeeded;

  return {
    detail:
      left > 0 && minutes > 0
        ? t("About {time} in your plan", { time: formatDuration(roundEstimate(minutes)) })
        : null,
    done: left === 0,
    key: "skills",
    kind: "lesson",
    label:
      rule === "examWeighted"
        ? t("Get the topics that weigh most to Solid")
        : t("Get every skill to Solid"),
    plusRequired: false,
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
            "{count, plural, one {# skill fading, back in your reviews} other {# skills fading, back in your reviews}}",
            { count: fading },
          ),
    done: fading === 0,
    key: "memory",
    kind: "review",
    label: t("Keep what you studied fresh"),
    plusRequired: false,
  };
}

function useTestLabel() {
  const t = useExtracted();

  return (kind: Preparation["components"]["mocks"]["kind"]): { kind: LearnKind; label: string } => {
    switch (kind) {
      case "fullReviews":
        return { kind: "practice", label: t("Do a full review in your test's format") };
      case "mockExams":
        return { kind: "mock", label: t("Take your first mock exam") };
      case "weeklyChallenges":
        return { kind: "challenge", label: t("Take your first weekly challenge") };
      default:
        return kind satisfies never;
    }
  };
}

function useTestItem(preparation: Preparation): StillNeededItem {
  const testLabel = useTestLabel();
  const { mocks } = preparation.components;

  return {
    detail: null,
    done: mocks.taken > 0,
    key: "test",
    ...testLabel(mocks.kind),
    plusRequired: mocks.plusRequired,
  };
}

export function useStillNeeded({
  preparation,
  stillNeeded,
}: {
  preparation: Preparation;
  stillNeeded: ProgressView["stillNeeded"];
}): StillNeededItem[] {
  const items = [useSkillsItem(stillNeeded), useMemoryItem(preparation), useTestItem(preparation)];
  return items.filter((item) => !item.done).slice(0, MAX_SHOWN);
}
