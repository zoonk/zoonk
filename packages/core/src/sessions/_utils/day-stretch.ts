import { type StudyBlockKind, type StudySessionBlock } from "@zoonk/db";
import {
  type ChallengeReachItem,
  isChallengeReached,
  isPhaseChallenge,
} from "../../checkpoints/_utils/challenge-reach";
import { readBlockPayload } from "../block-payload";
import { type PlannedCheckpoint, type PlannedLesson } from "../session-builder";

type Identified = { planItemId: string | null; planItemKey?: string | null };
type StretchLesson = Pick<PlannedLesson, "minutes" | "planItemId" | "planItemKey">;

type StretchChallenge = Pick<
  PlannedCheckpoint,
  "afterLessons" | "kind" | "minutes" | "mock" | "planItemId" | "planItemKey" | "rematch"
>;

/** Each phase challenge a session held, by plan item id and key: whether the learner started it. */
export function getSessionChallenges(
  blocks: readonly Pick<StudySessionBlock, "payload" | "startedAt">[],
): ReadonlyMap<string, boolean> {
  const held = blocks.flatMap((block) => {
    const { checkpoint, planItemId, planItemKey } = readBlockPayload(block);

    return isPhaseChallenge(checkpoint)
      ? [planItemId, planItemKey].flatMap((id) => (id === null ? [] : [{ block, id }]))
      : [];
  });

  const started = new Set(held.flatMap(({ block, id }) => (block.startedAt ? [id] : [])));

  return new Map(held.map(({ id }) => [id, started.has(id)]));
}

/** Every challenge follows the lessons, so two put-off ones can't take turns keeping lessons out; one the learner started there keeps its place. */
export function placePutOffChallenges<Challenge extends StretchChallenge>({
  checkpoints,
  hasLessons,
  lastSession = new Map(),
}: {
  checkpoints: readonly Challenge[];
  hasLessons: boolean;
  lastSession?: ReadonlyMap<string, boolean>;
}): Challenge[] {
  const started = (checkpoint: Challenge) =>
    lastSession.get(checkpoint.planItemId ?? "") ?? lastSession.get(checkpoint.planItemKey ?? "");

  const lessonsFirst =
    hasLessons &&
    checkpoints.some((checkpoint) => isPhaseChallenge(checkpoint) && started(checkpoint) === false);

  return checkpoints.map((checkpoint) =>
    lessonsFirst && isPhaseChallenge(checkpoint) && !started(checkpoint)
      ? { ...checkpoint, afterLessons: true }
      : checkpoint,
  );
}

function findStretchItem<T extends ChallengeReachItem>({
  entry,
  items,
}: {
  entry: Identified;
  items: readonly T[];
}): T | undefined {
  return items.find(
    (item) =>
      (entry.planItemId && item.id === entry.planItemId) ||
      (entry.planItemKey && item.key === entry.planItemKey),
  );
}

export function getLeadingChallenges<Challenge extends StretchChallenge>({
  checkpoints,
  items,
}: {
  checkpoints: readonly Challenge[];
  items: readonly ChallengeReachItem[];
}): Challenge[] {
  return checkpoints.filter((checkpoint) => {
    const boss = findStretchItem({ entry: checkpoint, items });

    return (
      isPhaseChallenge(checkpoint) &&
      !checkpoint.afterLessons &&
      (!boss || isChallengeReached({ boss, items }))
    );
  });
}

export function fundLeadingChallenges<Challenge extends { minutes: number; rematch: boolean }>({
  checkpoints,
  budget,
  overflow = true,
}: {
  checkpoints: readonly Challenge[];
  budget: number;
  overflow?: boolean;
}): Challenge[] {
  const funded: Challenge[] = [];
  let minutes = 0;

  for (const checkpoint of checkpoints.toSorted((a, b) => Number(a.rematch) - Number(b.rematch))) {
    if ((overflow && funded.length === 0) || minutes + checkpoint.minutes <= budget) {
      funded.push(checkpoint);
      minutes += checkpoint.minutes;
    }
  }

  return funded;
}

type DayStretchEntry<Lesson, Challenge> =
  | { kind: "lesson"; lesson: Lesson }
  | { kind: "challenge"; checkpoint: Challenge };

export function listDayStretch<
  Lesson extends StretchLesson = PlannedLesson,
  Challenge extends StretchChallenge = PlannedCheckpoint,
>({
  budget,
  checkpoints,
  items,
  leading = [],
  lessons,
  overflow = false,
  ahead = new Set(),
}: {
  ahead?: ReadonlySet<string>;
  budget: number;
  checkpoints: readonly Challenge[];
  items: readonly ChallengeReachItem[];
  leading?: readonly Challenge[];
  lessons: readonly Lesson[];
  overflow?: boolean;
}): DayStretchEntry<Lesson, Challenge>[] {
  type Entry = DayStretchEntry<Lesson, Challenge>;

  const reached = new Set(getLeadingChallenges({ checkpoints, items }));
  const funded = new Set(leading);
  const leadingMinutes = leading.reduce((sum, checkpoint) => sum + checkpoint.minutes, 0);

  const entries: Entry[] = [
    ...lessons.map((lesson): Entry => ({ kind: "lesson", lesson })),
    ...checkpoints
      .filter((checkpoint) => isPhaseChallenge(checkpoint))
      .map((checkpoint): Entry => ({ checkpoint, kind: "challenge" })),
  ];

  const afterLessons = (entry: Entry) =>
    entry.kind === "challenge" && Boolean(entry.checkpoint.afterLessons);

  const position = (entry: Entry) =>
    findStretchItem({ entry: entry.kind === "lesson" ? entry.lesson : entry.checkpoint, items })
      ?.position ?? (entry.kind === "challenge" ? -1 : 0);

  const result: Entry[] = [];
  const preceding = new Set(ahead);
  let room = budget - leadingMinutes;
  let stopped = false;

  for (const entry of entries.toSorted(
    (a, b) => Number(afterLessons(a)) - Number(afterLessons(b)) || position(a) - position(b),
  )) {
    if (entry.kind === "lesson") {
      const item = findStretchItem({ entry: entry.lesson, items });

      const fits =
        entry.lesson.minutes <= room ||
        (overflow && !result.some((prior) => prior.kind === "lesson") && room >= 1);

      stopped ||= !fits;

      if (!stopped) {
        result.push(entry);

        if (item) {
          preceding.add(item.id ?? item.key ?? "");
        }

        room -= entry.lesson.minutes;
      }
    } else {
      const checkpoint = entry.checkpoint;
      const boss = findStretchItem({ entry: checkpoint, items });

      if (reached.has(checkpoint)) {
        if (funded.has(checkpoint)) {
          result.push(entry);
        }
      } else if (
        checkpoint.minutes <= room &&
        boss &&
        isChallengeReached({ ahead: preceding, boss, items })
      ) {
        result.push(entry);
        room -= checkpoint.minutes;
      }
    }
  }

  return result;
}

export function orderDayBlocks<
  Block extends {
    kind: StudyBlockKind;
    lessonId: string | null;
    payload: StudySessionBlock["payload"];
  },
>({ blocks, items }: { blocks: readonly Block[]; items: readonly ChallengeReachItem[] }): Block[] {
  const ranks = ["review", "reinforcement", "stretch", "practice", "produce", "calendar"] as const;

  const group = (block: Block): (typeof ranks)[number] => {
    const payload = readBlockPayload(block);

    if (block.kind === "review") {
      return "review";
    }

    if (payload.reinforcement) {
      return "reinforcement";
    }

    if (block.kind === "learn" || (payload.checkpoint && isPhaseChallenge(payload.checkpoint))) {
      return "stretch";
    }

    if (block.kind === "practice") {
      return "practice";
    }

    if (block.kind === "produce") {
      return "produce";
    }

    return "calendar";
  };

  const rank = (block: Block) => ranks.indexOf(group(block));

  const position = (block: Block) =>
    findStretchItem({ entry: readBlockPayload(block), items })?.position ?? -1;

  const afterLessons = (block: Block) => Number(readBlockPayload(block).afterLessons);

  return blocks.toSorted(
    (a, b) =>
      rank(a) - rank(b) ||
      (group(a) === "stretch" ? afterLessons(a) - afterLessons(b) || position(a) - position(b) : 0),
  );
}
