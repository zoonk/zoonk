import { chunk } from "@zoonk/utils/chunk";
import { isStandInUnit } from "./plan-item-rules";
import { type QueueUnit } from "./plan-units";
import { splitStandIns } from "./stand-in-parts";
import { CHAPTER_LESSONS } from "./stand-in-size";

const OPEN_TOPICS = 3;
const TURN_LESSONS = 2;

type Topic = { skillId: string; stays: QueueUnit[][]; stayed: number };

type Stay = { taken: number; topic: Topic; units: QueueUnit[] };

/** One stay per written chapter, then the lessons not written yet in chapter-sized stays. */
function listStays(units: readonly QueueUnit[]): QueueUnit[][] {
  const chapters = Map.groupBy(
    units.filter((unit) => !isStandInUnit(unit)),
    (unit) => unit.chapterId ?? unit.key,
  );

  return [
    ...chapters.values(),
    ...chunk(splitStandIns(units.filter((unit) => isStandInUnit(unit))), CHAPTER_LESSONS),
  ];
}

function rotatePhase({
  prerequisites,
  units,
}: {
  prerequisites: ReadonlyMap<string, readonly string[]>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const topics = [...Map.groupBy(units, (unit) => unit.skillId ?? "")].map(
    ([skillId, own]): Topic => ({ skillId, stayed: 0, stays: listStays(own) }),
  );

  const bySkill = new Map(topics.map((topic) => [topic.skillId, topic]));

  const isReady = (topic: Topic) =>
    (prerequisites.get(topic.skillId) ?? []).every((skillId) => {
      const before = bySkill.get(skillId);
      return !before || before.stayed > 0 || before.stays.length === 0;
    });

  const waiting = [...topics];
  const open: Stay[] = [];
  const placed: QueueUnit[] = [];

  const fill = () => {
    while (open.length < OPEN_TOPICS) {
      const next =
        waiting.find((topic) => isReady(topic)) ?? (open.length === 0 ? waiting[0] : undefined);

      if (!next) {
        return;
      }

      waiting.splice(waiting.indexOf(next), 1);
      open.push({ taken: 0, topic: next, units: next.stays.shift() ?? [] });
    }
  };

  const takeTurn = (at: number): number => {
    const stay = open[at];

    if (!stay) {
      return 0;
    }

    const turn = stay.units.splice(0, TURN_LESSONS - (stay.taken % TURN_LESSONS));
    stay.taken += turn.length;
    placed.push(...turn);

    if (stay.units.length > 0) {
      return at + 1;
    }

    open.splice(at, 1);
    stay.topic.stayed += 1;

    if (stay.topic.stays.length > 0) {
      waiting.push(stay.topic);
    }

    return at;
  };

  fill();

  for (let at = 0; open.length > 0; at %= Math.max(1, open.length)) {
    at = takeTurn(at);
    fill();
  }

  return placed;
}

function rotateOrder({
  order,
  prerequisites,
}: {
  order: readonly QueueUnit[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
}): QueueUnit[] {
  const runs = order.reduce<QueueUnit[][]>((list, unit) => {
    const run = list.at(-1);
    const first = run?.[0];
    const rotates = unit.kind === "lesson" && unit.skillId !== null;

    if (rotates && first?.kind === "lesson" && first.skillId && first.phase === unit.phase) {
      run?.push(unit);
      return list;
    }

    list.push([unit]);
    return list;
  }, []);

  return runs.flatMap((run) =>
    run[0]?.kind === "lesson" && run[0].skillId ? rotatePhase({ prerequisites, units: run }) : run,
  );
}

/**
 * A language phase teaches three topics at a time, two lessons each in turn, each staying for one
 * chapter before the next topic takes its place; every topic comes back on later rounds with its
 * next chapter. The turns come from the plan's whole `order`, finished lessons included, so a
 * re-plan lays `units`, what's left, out in the turns it already had.
 */
export function rotateTopics({
  order,
  prerequisites,
  units,
}: {
  order: readonly QueueUnit[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const pending = Map.groupBy(splitStandIns(units), (unit) => unit.key);

  const placed = rotateOrder({ order, prerequisites }).flatMap((slot) => {
    const next = pending.get(slot.key)?.shift();
    return next ? [next] : [];
  });

  return [...placed, ...[...pending.values()].flat()];
}
