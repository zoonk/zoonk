import { getRuleItemKey } from "./rules/rule-items";
import { type SimResult } from "./sim/sim-runner";
import { type SimPlan } from "./sim/sim-world";

/**
 * What the first run of a traced life's last day did to the work of the skills it didn't outline:
 * the items it took out and put in, by key, whatever their days.
 */
export function listNextDaySwaps({ events, plans }: Pick<SimResult, "events" | "plans">) {
  const index = events.findLastIndex((event) => event.event.kind === "newDay");
  const before = plans[index - 1]?.items ?? [];
  const after = plans[index]?.items ?? [];
  const lessonIds = new Set(before.flatMap((item) => item.lessonId ?? []));

  const outlined = new Set(
    after.flatMap((item) =>
      item.lessonId && item.skillId && !lessonIds.has(item.lessonId) ? [item.skillId] : [],
    ),
  );

  const listOthers = (items: SimPlan["items"]) =>
    items.filter((item) => !outlined.has(item.skillId ?? "")).map((item) => getRuleItemKey(item));

  const was = listOthers(before);
  const now = listOthers(after);

  return {
    added: now.filter((key) => !was.includes(key)),
    lost: was.filter((key) => !now.includes(key)),
  };
}
