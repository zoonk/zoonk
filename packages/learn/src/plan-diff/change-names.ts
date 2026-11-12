"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { toTopicWords } from "../syllabus/topic-number";

export type PlanEffect = NonNullable<PlanChangeView["effect"]>;

export type GoalDateMove = { after: string; before: string | null };

export type ChangeOptions = { byDate?: boolean; goalDate?: GoalDateMove };

export function getTopicNames(areas: PlanEffect["topicsLeftOut"]): string[] {
  return (areas ?? []).flatMap((area) => area.topics.map((topic) => toTopicWords(topic)));
}

/** Without a date the plan keeps every lesson, so only the net count changes. */
export function countLessons(
  effect: PlanEffect,
  byDate: boolean,
): { added: number; removed: number } {
  if (byDate) {
    return { added: effect.lessonsAdded, removed: effect.lessonsRemoved };
  }

  const net = effect.lessonsAdded - effect.lessonsRemoved;
  return { added: Math.max(net, 0), removed: Math.max(-net, 0) };
}

/** The first `limit` names, then how many more: a card never lists every topic or lesson. */
export function useNames() {
  const t = useExtracted();
  const format = useFormatter();

  return ({
    kind,
    limit,
    names,
  }: {
    kind: "lessons" | "topics";
    limit: number;
    names: string[];
  }): string => {
    const named = names.slice(0, limit);
    const count = names.length - named.length;

    if (count === 0) {
      return format.list(named, { type: "conjunction" });
    }

    return kind === "topics"
      ? t("{names} and {count, plural, one {# more topic} other {# more topics}}", {
          count,
          names: named.join(", "),
        })
      : t({
          description:
            "{names} are a few of the lessons a plan change affects, as examples; the full count is shown beside them.",
          message: "{names} and more",
          values: { names: named.join(", ") },
        });
  };
}
