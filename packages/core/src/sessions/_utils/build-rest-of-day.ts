import { type StudySessionBlock } from "@zoonk/db";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { getItemKey } from "../../plans/planner/plan-items";
import { readBlockPayload } from "../block-payload";
import { isPhaseChallenge } from "../block-wait";
import { type SessionBuildInput, buildSessionBlocks } from "../session-builder";
import { keepLessonsBeforeUnqueuedDuels } from "./lessons-before-challenges";
import { type SessionPlanItem } from "./session-plan-item";

export function buildRestOfDay({
  input,
  items,
  kept,
}: {
  input: SessionBuildInput;
  items: readonly SessionPlanItem[];
  kept: readonly StudySessionBlock[];
}) {
  const built = buildSessionBlocks(input);

  if (!input.checkpoints.some((checkpoint) => isPhaseChallenge({ checkpoint }))) {
    return built;
  }

  const held = new Set(
    [...kept, ...built.blocks].flatMap((block) => {
      const payload = readBlockPayload(block);
      return [block.lessonId, payload.planItemId, payload.planItemKey].filter(Boolean);
    }),
  );

  const missing = items.filter(
    (item) =>
      LEARN_KINDS.has(item.kind) &&
      item.status === "todo" &&
      !held.has(item.id) &&
      !held.has(getItemKey(item)) &&
      (!item.lessonId || !held.has(item.lessonId)),
  );

  const checkpoints = input.checkpoints.filter((checkpoint) => {
    const item = items.find(
      (candidate) =>
        (checkpoint.planItemId && candidate.id === checkpoint.planItemId) ||
        getItemKey(candidate) === checkpoint.planItemKey,
    );

    return (
      !isPhaseChallenge({ checkpoint }) ||
      !item ||
      !missing.some((lesson) => lesson.position < item.position)
    );
  });

  if (checkpoints.length === input.checkpoints.length) {
    return built;
  }

  const unqueuedCheckpoints = input.checkpoints.filter(
    (checkpoint) => !checkpoints.includes(checkpoint),
  );

  const keepLessons = (lessons: SessionBuildInput["lessons"]) =>
    keepLessonsBeforeUnqueuedDuels({ checkpoints: unqueuedCheckpoints, items, lessons });

  return buildSessionBlocks({
    ...input,
    checkpoints,
    fillLessons: keepLessons(input.fillLessons ?? []),
    lessons: keepLessons(input.lessons),
  });
}
