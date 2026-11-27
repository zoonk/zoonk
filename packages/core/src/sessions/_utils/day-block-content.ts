import { type StudySessionBlock } from "@zoonk/db";
import { type PlanState } from "../../plans/planner/plan-state";
import { planWritingScope } from "../../plans/planner/plan-writing-scope";
import { getBlockItemIds, hasWritingProgress, readBlockPayload } from "../block-payload";
import { type PlannedBlock } from "../session-builder";

function getContent({
  anyOrder,
  block,
}: {
  anyOrder: boolean;
  block: Pick<PlannedBlock, "estimatedMinutes" | "kind" | "lessonId" | "payload">;
}) {
  const itemIds = getBlockItemIds(block.payload);

  return [
    block.kind,
    block.lessonId,
    block.estimatedMinutes,
    block.payload.patternId,
    block.payload.returning,
    ...block.payload.mistakeIds,
    block.payload.writing?.taskKey,
    block.payload.writing?.unit,
    block.payload.writingLessonId,
    Boolean(block.payload.writingPlacement),
    ...(anyOrder ? itemIds.toSorted() : itemIds),
  ].join(":");
}

/** With anyOrder, reordered identical questions are unchanged; untouched days still compare order to preserve requested focus. */
export function hasSameContent({
  anyOrder,
  planned,
  replaced,
}: {
  anyOrder: boolean;
  planned: readonly PlannedBlock[];
  replaced: readonly StudySessionBlock[];
}): boolean {
  return (
    planned.length === replaced.length &&
    planned.every((block, index) => {
      const current = replaced[index];

      return (
        current !== undefined &&
        getContent({ anyOrder, block }) ===
          getContent({
            anyOrder,
            block: {
              ...current,
              estimatedMinutes: current.estimatedMinutes ?? 0,
              payload: readBlockPayload(current),
            },
          })
      );
    })
  );
}

export function hasSameBlocks({
  locked,
  read,
}: {
  locked: readonly StudySessionBlock[];
  read: readonly StudySessionBlock[];
}): boolean {
  return (
    read.length === locked.length &&
    read.every((block, index) => {
      const current = locked[index];

      return (
        current?.id === block.id &&
        current.status === block.status &&
        readBlockPayload(current).writing?.admissionId ===
          readBlockPayload(block).writing?.admissionId
      );
    })
  );
}

export function getKeptBlocks(
  blocks: readonly StudySessionBlock[],
  plan: Pick<PlanState, "graph" | "settings"> | undefined,
): StudySessionBlock[] {
  const keptSkills = plan?.settings.skippedAreas.length
    ? planWritingScope({
        graph: plan.graph,
        skippedAreas: plan.settings.skippedAreas,
        structure: null,
      }).keptSkills
    : null;

  const openedLessons = new Set(
    blocks.flatMap(({ lessonId, status }) =>
      lessonId && (status === "active" || status === "completed") ? [lessonId] : [],
    ),
  );

  return blocks.filter((block) => {
    const payload = readBlockPayload(block);
    const { extra, skillIds, writingLessonId } = payload;

    return (
      block.status !== "pending" ||
      extra ||
      payload.mistakeIds.length > 0 ||
      payload.patternId !== null ||
      payload.returning !== null ||
      hasWritingProgress(payload) ||
      (writingLessonId !== undefined &&
        openedLessons.has(writingLessonId) &&
        (!keptSkills || skillIds.some((id) => keptSkills.has(id))))
    );
  });
}
