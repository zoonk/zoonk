import { type StudySessionBlock } from "@zoonk/db";
import { getBlockItemIds, isRemedialPractice, readBlockPayload } from "../block-payload";
import { type PlannedLesson, type SessionBuildInput, buildSessionBlocks } from "../session-builder";
import { getSessionUsedMinutes } from "../session-minutes";

type SavedBlock = Pick<
  StudySessionBlock,
  "estimatedMinutes" | "id" | "kind" | "lessonId" | "payload" | "status"
>;

type OpenedDay = { blocks: readonly SavedBlock[]; plannedMinutes: number };

function isRemedialBlock(block: SavedBlock) {
  const payload = readBlockPayload(block);
  return isRemedialPractice(payload) || payload.returning !== null;
}

/** Preserve opened practice's share only after study begins; unstarted days rebuild whole. */
function getOpenedPractice({
  kept,
  session,
  teachingMinutes,
}: {
  kept: readonly SavedBlock[];
  session: OpenedDay;
  teachingMinutes: number;
}): SessionBuildInput["openedPractice"] {
  const keptIds = new Set(kept.map((block) => block.id));

  const minutes = getSessionUsedMinutes(
    session.blocks.filter((block) => block.kind === "practice" && !keptIds.has(block.id)),
  );

  if (
    kept.every((block) => block.status === "pending" || isRemedialBlock(block)) ||
    minutes <= 0 ||
    session.plannedMinutes <= 0
  ) {
    return undefined;
  }

  return { dayMinutes: session.plannedMinutes, minutes: minutes + teachingMinutes };
}

function withoutKept({
  dated,
  input,
  kept,
  session,
}: {
  dated: boolean;
  input: SessionBuildInput;
  kept: readonly SavedBlock[];
  session: OpenedDay;
}): SessionBuildInput {
  const kinds = new Set(
    kept.filter((block) => !isRemedialPractice(readBlockPayload(block))).map(({ kind }) => kind),
  );

  const remedialPractice = kept.filter((block) => isRemedialPractice(readBlockPayload(block)));
  const remedialTeaching = kept.filter((block) => readBlockPayload(block).returning !== null);
  const mistakes = getSessionUsedMinutes(remedialPractice.filter(({ kind }) => kind === "review"));

  const teaching = getSessionUsedMinutes([
    ...remedialTeaching,
    ...remedialPractice.filter(({ kind }) => kind === "practice"),
  ]);

  const usedMinutes = getSessionUsedMinutes(kept) - mistakes - teaching;

  const lessonIds = new Set(kept.flatMap((block) => (block.lessonId ? [block.lessonId] : [])));
  const itemIds = new Set(kept.flatMap((block) => getBlockItemIds(readBlockPayload(block))));

  const keptCheckpoints = new Set(
    kept.flatMap((block) =>
      block.kind === "checkpoint" ? [readBlockPayload(block).planItemId] : [],
    ),
  );

  const isNewLesson = (lesson: { lessonId: string | null }) =>
    !lesson.lessonId || !lessonIds.has(lesson.lessonId);

  const drillLessons = new Set(kept.map((block) => readBlockPayload(block).writingLessonId));

  const newLessons = (lessons: readonly PlannedLesson[]) =>
    lessons
      .filter((lesson) => isNewLesson(lesson))
      .map((lesson) =>
        lesson.drill && lesson.lessonId && drillLessons.has(lesson.lessonId)
          ? { ...lesson, drill: undefined, minutes: lesson.minutes - lesson.drill.minutes }
          : lesson,
      );

  return {
    ...input,
    capsules: kinds.has("review") ? [] : input.capsules,
    checkpoints: input.checkpoints
      .filter((checkpoint) => !keptCheckpoints.has(checkpoint.planItemId))
      .map((checkpoint) => ({
        ...checkpoint,
        reinforcement: checkpoint.reinforcement?.filter(isNewLesson),
      })),
    fillLessons: input.fillLessons && newLessons(input.fillLessons),
    lessons: newLessons(input.lessons),
    openedPractice: getOpenedPractice({ kept, session, teachingMinutes: teaching }),
    placementItemIds: kinds.has("review") ? [] : input.placementItemIds,
    practice: input.practice.filter((item) => !itemIds.has(item.itemId)),
    // A day that keeps its practice gives the rest of its time to lessons.
    practiceShare: kinds.has("practice") ? 0 : input.practiceShare,
    remedial:
      mistakes || teaching
        ? { dated, kept: { mistakes, teaching }, mistakes: [], teaching: [] }
        : undefined,
    usedMinutes,
  };
}

export function buildRemainingDay({
  dated,
  input,
  kept,
  session,
}: {
  dated: boolean;
  input: SessionBuildInput;
  kept: readonly SavedBlock[];
  session: OpenedDay;
}) {
  const remaining = withoutKept({ dated, input, kept, session });
  const { blocks, plannedMinutes } = buildSessionBlocks(remaining);

  return {
    blocks,
    plannedMinutes: Math.ceil(
      Math.max(getSessionUsedMinutes(kept), (remaining.usedMinutes ?? 0) + plannedMinutes),
    ),
  };
}
