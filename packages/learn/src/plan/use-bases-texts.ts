"use client";

import { type PlanBasesView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";

export function usePlanBases(): PlanBasesView | null {
  const { plan } = usePlanScreen();
  return plan.bases && plan.bases.items.length > 0 ? plan.bases : null;
}

function minutesOf(item: PlanBasesView["items"][number]): number {
  return item.choice === "skip" ? 0 : item.minutes[item.choice];
}

export function useSummaryText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (bases: PlanBasesView): string => {
    const values = {
      count: bases.items.length,
      time: formatDuration(bases.items.reduce((sum, item) => sum + minutesOf(item), 0)),
    };

    const choices = new Set(bases.items.map((item) => item.choice));
    const [shared] = choices;

    if (choices.size > 1) {
      return t(
        "{count, plural, one {# prerequisite} other {# prerequisites}} · your choices · {time}",
        values,
      );
    }

    if (shared === "deep") {
      return t(
        "{count, plural, one {# prerequisite} other {# prerequisites}} · every lesson · {time}",
        values,
      );
    }

    if (shared === "quick") {
      return t(
        "{count, plural, one {# prerequisite} other {# prerequisites}} · one short lesson each · {time}",
        values,
      );
    }

    if (shared === "skip") {
      return t("{count, plural, one {# prerequisite} other {# prerequisites}} · skipped", values);
    }

    return t(
      "{count, plural, one {# prerequisite} other {# prerequisites}} · first lessons only · {time}",
      values,
    );
  };
}
