import { type EntitlementTier } from "../../entitlements/contract";
import { type GoalPlan } from "../../learner/_utils/goal-skill-graph";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { getItemKey } from "../../plans/planner/plan-items";
import { type SessionPlanItem } from "../_utils/session-plan-item";
import { type PlannedBlock } from "../session-builder";
import { type MissionKind, type MissionPick } from "./catalog";

export type MissionFactBlock = PlannedBlock & { id?: string };

export function toBlockPick({
  block,
  kind,
  total = 1,
}: {
  block: MissionFactBlock;
  kind: MissionKind;
  total?: number;
}): MissionPick {
  const { payload } = block;

  return {
    anchor: {
      blockKind: block.kind,
      ...(payload.planItemId ? { planItemId: payload.planItemId } : {}),
      ...(payload.planItemKey ? { planItemKey: payload.planItemKey } : {}),
      ...(block.lessonId ? { lessonIds: [block.lessonId] } : {}),
    },
    detail: {
      minutes: block.estimatedMinutes,
      ...(payload.title ? { title: payload.title } : {}),
      ...(payload.checkpoint?.rematch ? { rematch: true } : {}),
    },
    kind,
    ...(block.id ? { opens: { blockId: block.id, kind: "block" as const } } : {}),
    total,
  };
}

function toCheckpointKind(block: MissionFactBlock): MissionKind | null {
  const checkpoint = block.payload.checkpoint;

  if (!checkpoint) {
    return null;
  }

  if (checkpoint.mock) {
    return "mock";
  }

  return checkpoint.kind === "weekly" ? "weeklyChallenge" : "challenge";
}

export function blockCandidates({
  blocks,
  plannedMinutes,
  tier,
}: {
  blocks: readonly MissionFactBlock[];
  plannedMinutes: number;
  tier: EntitlementTier;
}): MissionPick[] {
  const planned = blocks.filter((block) => !block.payload.extra && !block.payload.reinforcement);
  const reviews = planned.filter((block) => block.kind === "review");
  const review = reviews[0];
  const lessons = planned.filter((block) => block.kind === "learn");
  const lesson = planned.find((block) => block.kind === "learn");
  const practice = planned.find((block) => block.kind === "practice");
  const essay = planned.find((block) => block.kind === "produce");

  const checkpoints = planned
    .filter((block) => block.kind === "checkpoint")
    .flatMap((block) => {
      const kind = toCheckpointKind(block);

      return !kind ||
        (kind === "mock" && (tier !== "plus" || block.estimatedMinutes > plannedMinutes))
        ? []
        : [toBlockPick({ block, kind })];
    });

  return [
    ...(review
      ? [
          {
            ...toBlockPick({ block: review, kind: "review", total: reviews.length }),
            anchor: { blockKind: "review" as const },
          },
        ]
      : []),
    ...(lesson
      ? [
          {
            ...toBlockPick({ block: lesson, kind: "somethingNew" }),
            anchor: {
              blockKind: "learn" as const,
              lessonIds: lessons.flatMap((entry) => entry.lessonId ?? []),
              planItemIds: lessons.flatMap((entry) => entry.payload.planItemId ?? []),
            },
          },
        ]
      : []),
    ...(practice ? [toBlockPick({ block: practice, kind: "practice" })] : []),
    ...(essay ? [toBlockPick({ block: essay, kind: "essay" })] : []),
    ...checkpoints,
  ];
}

/** A selected item's logical key is authoritative until the POST gives it a saved row ID. */
function isItemBlock({ block, item }: { block: MissionFactBlock; item: SessionPlanItem }): boolean {
  return item.id === null
    ? block.payload.planItemKey === (item.key ?? getItemKey(item))
    : block.payload.planItemId === item.id;
}

export function finishChapterCandidate({
  blocks,
  items,
  goalPlan,
}: {
  blocks: readonly MissionFactBlock[];
  goalPlan: GoalPlan;
  items: readonly SessionPlanItem[];
}): MissionPick | null {
  const learning = blocks.filter(
    (block) => block.kind === "learn" && !block.payload.extra && !block.payload.reinforcement,
  );

  const chapterIds = [
    ...new Set(
      learning.flatMap(
        (block) =>
          block.payload.chapterId ??
          items.find((item) => isItemBlock({ block, item }))?.chapterId ??
          [],
      ),
    ),
  ];

  const findRemaining = (chapterId: string) =>
    items.filter(
      (item) =>
        item.chapterId === chapterId && item.status === "todo" && LEARN_KINDS.has(item.kind),
    );

  const chapterId = chapterIds.find((id) => {
    const remaining = findRemaining(id);

    return (
      remaining.length > 0 &&
      remaining.length <= 2 &&
      remaining.every(
        (item) =>
          item.kind === "lesson" &&
          item.lessonId &&
          learning.some((block) => isItemBlock({ block, item })),
      )
    );
  });

  if (!chapterId) {
    return null;
  }

  const remaining = findRemaining(chapterId);

  const first = learning.find(
    (block) => remaining[0] && isItemBlock({ block, item: remaining[0] }),
  );

  const chapterTitle = goalPlan.skills.find((skill) => skill.areaId === chapterId)?.areaTitle;

  return {
    anchor: {
      blockKind: "learn",
      chapterId,
      lessonIds: remaining.flatMap((item) => item.lessonId ?? []),
      planItemIds: remaining.flatMap((item) => item.id ?? []),
    },
    detail: {
      count: remaining.length,
      ...(chapterTitle ? { chapterTitle } : {}),
      minutes: learning
        .filter((block) => remaining.some((item) => isItemBlock({ block, item })))
        .reduce((sum, block) => sum + block.estimatedMinutes, 0),
    },
    kind: "finishChapter",
    ...(first?.id ? { opens: { blockId: first.id, kind: "block" as const } } : {}),
    total: remaining.length,
  };
}
