"use client";

import { type PlanItemView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useExperienceMode } from "../mode-provider";

/**
 * Lessons and chapters show their title; the plan's other stops are named by kind, with Fun's names
 * in Fun (the Big Challenge, a phase boss). A skill whose lessons are still being written shows as
 * such under its course, never by the skill's name.
 */
export function useItemTitle() {
  const t = useExtracted();
  const mode = useExperienceMode();

  return (item: Pick<PlanItemView, "kind" | "title" | "writing">): string => {
    if (item.writing) {
      return item.title
        ? t("{course} (being written)", { course: item.title })
        : t("Lessons being written");
    }

    switch (item.kind) {
      case "review":
        return t("Review");
      case "checkpoint":
        return mode === "fun" ? t("Big Challenge") : t("Weekly challenge");
      case "mock":
        return t("Mock exam");
      case "boss":
        return mode === "fun" ? t("Phase boss") : t("Phase checkpoint");
      case "chapter":
        return item.title;
      case "lesson":
        return item.title;
      default:
        return item.title;
    }
  };
}

/** The week's checkpoint or mock exam, which both modes point out. */
export function findWeekCheckpoint<TItem extends Pick<PlanItemView, "kind">>(
  items: readonly TItem[],
): TItem | null {
  return items.find((item) => item.kind === "mock" || item.kind === "checkpoint") ?? null;
}
