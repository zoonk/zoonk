import { type StudyBlockKind, type StudySessionBlock } from "@zoonk/db";
import {
  type ChallengeReachItem,
  isChallengeReached,
  isPhaseChallenge,
} from "../../checkpoints/_utils/challenge-reach";
import { readBlockPayload } from "../block-payload";
import { type PlannedCheckpoint, type PlannedLesson } from "../session-builder";

type Identified = { planItemId: string | null; planItemKey?: string | null };

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

export function getLeadingChallenges({
  checkpoints,
  items,
}: {
  checkpoints: readonly PlannedCheckpoint[];
  items: readonly ChallengeReachItem[];
}): PlannedCheckpoint[] {
  return checkpoints.filter((checkpoint) => {
    const boss = findStretchItem({ entry: checkpoint, items });
    return isPhaseChallenge(checkpoint) && (!boss || isChallengeReached({ boss, items }));
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

export type DayStretchEntry =
  | { kind: "lesson"; lesson: PlannedLesson }
  | { kind: "challenge"; checkpoint: PlannedCheckpoint };

export function listDayStretch({
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
  checkpoints: readonly PlannedCheckpoint[];
  items: readonly ChallengeReachItem[];
  leading?: readonly PlannedCheckpoint[];
  lessons: readonly PlannedLesson[];
  overflow?: boolean;
}): DayStretchEntry[] {
  const reached = new Set(getLeadingChallenges({ checkpoints, items }));
  const funded = new Set(leading);
  const leadingMinutes = leading.reduce((sum, checkpoint) => sum + checkpoint.minutes, 0);

  const entries: DayStretchEntry[] = [
    ...lessons.map((lesson): DayStretchEntry => ({ kind: "lesson", lesson })),
    ...checkpoints
      .filter((checkpoint) => isPhaseChallenge(checkpoint))
      .map((checkpoint): DayStretchEntry => ({ checkpoint, kind: "challenge" })),
  ];

  const position = (entry: DayStretchEntry) =>
    findStretchItem({ entry: entry.kind === "lesson" ? entry.lesson : entry.checkpoint, items })
      ?.position ?? (entry.kind === "challenge" ? -1 : 0);

  const result: DayStretchEntry[] = [];
  const preceding = new Set(ahead);
  let room = budget - leadingMinutes;
  let stopped = false;

  for (const entry of entries.toSorted((a, b) => position(a) - position(b))) {
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

  return blocks.toSorted(
    (a, b) => rank(a) - rank(b) || (group(a) === "stretch" ? position(a) - position(b) : 0),
  );
}
