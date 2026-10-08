"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { useExtracted } from "next-intl";
import { type LearnKind } from "../../_components/kind-tile";
import { useFormatDuration } from "../../_utils/time-format";
import { type Preparation } from "./use-preparation-parts";

/** The most a learner is shown at once: one or two things to do, never a checklist. */
const MAX_SHOWN = 2;

export type StillNeededItem = {
  detail: string | null;
  done: boolean;
  key: "memory" | "skills" | "test";
  kind: LearnKind;
  label: string;
  /** Something the learner's plan doesn't include: the row carries the Plus mark. */
  plusRequired: boolean;
};

/** Skills still below their bar, with the plan's time for them. */
function useSkillsItem(stillNeeded: ProgressView["stillNeeded"]): StillNeededItem {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { left, minutes, rule } = stillNeeded;

  return {
    detail:
      left === 0
        ? null
        : [
            t("{count, plural, one {# skill to go} other {# skills to go}}", { count: left }),
            minutes > 0 && t("about {time} in your plan", { time: formatDuration(minutes) }),
          ]
            .filter(Boolean)
            .join(" · "),
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

/** Nothing fading: reviews keep what was studied. */
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

/** What the test is called, and the tile it shows with. */
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

/**
 * The real test under real conditions: an exam's mock exam (or, when the learner's plan has none,
 * a full review in the exam's format), or another goal's weekly challenge.
 */
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

/**
 * The one or two things between the learner and the goal that aren't done yet, most important
 * first. Never a promise: each is something to do, not a result.
 */
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
