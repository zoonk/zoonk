import { chunk } from "@zoonk/utils/chunk";
import { type KeptLessons } from "./kept-items";
import { isStandInUnit } from "./plan-item-rules";
import { type QueueUnit } from "./plan-units";
import { splitStandIns } from "./stand-in-parts";
import { CHAPTER_LESSONS } from "./stand-in-size";

const OPEN_TOPICS = 3;
const TURN_LESSONS = 2;

/** A lesson the learner already has, kept in the replay so every re-plan resumes the same turns. */
type Slot = QueueUnit | null;

type Topic = { skillId: string; stays: Slot[][]; stayed: number };

type Stay = { slots: Slot[]; taken: number; topic: Topic };

function listDone(count: number): Slot[] {
  return Array.from({ length: count }, () => null);
}

/** One stay per written chapter, then the lessons not written yet in chapter-sized stays. */
function listStays({
  kept,
  units,
}: {
  kept: readonly KeptLessons[];
  units: readonly QueueUnit[];
}): Slot[][] {
  const doneIn = (chapterId: string | null) =>
    kept.reduce((total, entry) => total + (entry.chapterId === chapterId ? entry.lessons : 0), 0);

  const unwritten = units.filter((unit) => isStandInUnit(unit));

  const chapters = Map.groupBy(
    units.filter((unit) => !isStandInUnit(unit)),
    (unit) => unit.chapterId ?? unit.key,
  );

  const finished = [
    ...new Set(kept.flatMap((entry) => (entry.chapterId === null ? [] : [entry.chapterId]))),
  ].filter((chapterId) => !chapters.has(chapterId));

  return [
    ...finished.map((chapterId) => listDone(doneIn(chapterId))),
    ...[...chapters].map(([chapterId, own]) => [...listDone(doneIn(chapterId)), ...own]),
    ...chunk([...listDone(doneIn(null)), ...splitStandIns(unwritten)], CHAPTER_LESSONS),
  ];
}

function rotatePhase({
  kept,
  prerequisites,
  units,
}: {
  kept: readonly KeptLessons[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const topics = [...Map.groupBy(units, (unit) => unit.skillId ?? "")].map(
    ([skillId, own]): Topic => ({
      skillId,
      stayed: 0,
      stays: listStays({ kept: kept.filter((entry) => entry.skillId === skillId), units: own }),
    }),
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
      open.push({ slots: next.stays.shift() ?? [], taken: 0, topic: next });
    }
  };

  const takeTurn = (at: number): number => {
    const stay = open[at];

    if (!stay) {
      return 0;
    }

    const turn = stay.slots.splice(0, TURN_LESSONS - (stay.taken % TURN_LESSONS));
    stay.taken += turn.length;
    placed.push(...turn.filter((slot) => slot !== null));

    if (stay.slots.length > 0) {
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

/**
 * A language phase teaches three topics at a time, two lessons each in turn, each staying for one
 * chapter before the next topic takes its place; every topic comes back on later rounds with its
 * next chapter. The order is replayed from each topic's first lesson, so a re-plan resumes the same
 * turns.
 */
export function rotateTopics({
  kept,
  prerequisites,
  units,
}: {
  kept: readonly KeptLessons[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const runs = units.reduce<QueueUnit[][]>((list, unit) => {
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
    run[0]?.kind === "lesson" && run[0].skillId
      ? rotatePhase({ kept, prerequisites, units: run })
      : run,
  );
}
