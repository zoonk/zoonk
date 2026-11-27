import { type StudySessionBlock } from "@zoonk/db";
import { getPlannedQuestions } from "../../checkpoints/checkpoint-rules";
import { getWritingAttemptId } from "../../exams/essays/_utils/writing-attempt-id";
import { type indexWritingTasks } from "../../exams/essays/_utils/writing-task-positions";
import { type BlockCheckpoint, getBlockItemIds, readBlockPayload } from "../block-payload";
import { studyCheckpointSchema } from "../block-view-contract";
import { getStoredBlockWait } from "../block-wait";
import { type BlockOutcome, EMPTY_OUTCOME, estimateBrainPower } from "../brain-power";
import { getBlockScreen } from "../day-block";
import { type DayBlockView } from "../day-view";
import { getPracticeNumber } from "./practice-number";

/** Planned blocks lack database ids until persistence. */
export type DayBlockInput = Pick<
  StudySessionBlock,
  | "brainPower"
  | "canDo"
  | "estimatedMinutes"
  | "kind"
  | "lessonId"
  | "payload"
  | "position"
  | "status"
> & { id?: string };

const LESSON_QUESTIONS_PER_MINUTE = 0.5;
const NO_SKILLS: ReadonlySet<string> = new Set();

function getEstimateOutcome(block: DayBlockInput): { outcome: BlockOutcome; questions: number } {
  const payload = readBlockPayload(block);
  const questions = getBlockItemIds(payload).length;

  if (block.kind === "learn") {
    const minutes = block.estimatedMinutes ?? 0;

    return {
      outcome: { ...EMPTY_OUTCOME, firstLessonCompletion: true },
      questions: Math.round(minutes * LESSON_QUESTIONS_PER_MINUTE),
    };
  }

  const checkpoint = payload.checkpoint ? { kind: payload.checkpoint.kind, passed: true } : null;

  return {
    outcome: { ...EMPTY_OUTCOME, capsulesOpened: payload.capsules.length, checkpoint },
    questions,
  };
}

function toViewCheckpoint(checkpoint: BlockCheckpoint | null): DayBlockView["checkpoint"] {
  if (!checkpoint) {
    return null;
  }

  const { mockQuestions: _mockQuestions, ...view } = checkpoint;
  return studyCheckpointSchema.parse(view);
}

function getBlockQuestions(
  block: DayBlockInput,
  checkpoint: BlockCheckpoint | null,
  items: number,
) {
  if (typeof checkpoint?.mockQuestions === "number") {
    return checkpoint.mockQuestions;
  }

  return checkpoint && !checkpoint.mock && checkpoint.passMark > 0 && block.status === "pending"
    ? getPlannedQuestions(items)
    : items;
}

function getWritingFields({
  answeredAttemptIds,
  block,
  payload,
  savedWritingTasks,
  writingTasks,
}: {
  answeredAttemptIds?: ReadonlySet<string>;
  block: DayBlockInput;
  payload: ReturnType<typeof readBlockPayload>;
  savedWritingTasks?: ReadonlyMap<string, DayBlockView["writingTask"] | null>;
  writingTasks?: ReturnType<typeof indexWritingTasks>;
}): Pick<DayBlockView, "hasWritingDraft" | "writingAvailability" | "writingTask" | "writingUnit"> {
  const { writing } = payload;

  if (!writing) {
    return { writingAvailability: undefined };
  }

  const continuing =
    writing.admissionId && (block.status === "active" || block.status === "pending");

  const [itemId] = payload.itemIds;
  const saved = itemId ? savedWritingTasks?.get(itemId) : undefined;
  const writingTask = saved === undefined ? writingTasks?.get(writing.taskKey) : saved;
  const hasDraftText = block.status !== "skipped" && Boolean(writing.draft?.text.trim());

  const hasWritingDraft =
    hasDraftText && writing.admissionId && itemId
      ? answeredAttemptIds &&
        !answeredAttemptIds.has(getWritingAttemptId({ admissionId: writing.admissionId, itemId }))
      : false;

  return {
    hasWritingDraft,
    ...(writingTask && { writingTask }),
    writingAvailability: { status: continuing ? "continue" : "available" },
    writingUnit: writing.unit,
  };
}

export function toDayBlockView({
  answeredAttemptIds,
  answeredItemIds,
  block,
  blocks,
  blockedTestOutChapters = NO_SKILLS,
  oftenTestedSkillIds = NO_SKILLS,
  savedWritingTasks,
  preparing = false,
  subject = null,
  writingTasks,
  subjectExtra,
}: {
  answeredAttemptIds?: ReadonlySet<string>;
  answeredItemIds: ReadonlySet<string>;
  block: DayBlockInput;
  /** The whole day, which a block's wait and a practice's number depend on. */
  blocks: readonly DayBlockInput[];
  blockedTestOutChapters?: ReadonlySet<string>;
  /** The exam goal's skills its board asks a lot; empty for other goals. */
  oftenTestedSkillIds?: ReadonlySet<string>;
  savedWritingTasks?: ReadonlyMap<string, DayBlockView["writingTask"] | null>;
  preparing?: boolean;
  subject?: string | null;
  writingTasks?: ReturnType<typeof indexWritingTasks>;
  subjectExtra?: DayBlockView["subjectExtra"];
}): DayBlockView {
  const payload = readBlockPayload(block);
  const itemIds = getBlockItemIds(payload);
  const teaches = block.kind === "learn" || block.kind === "practice" || block.kind === "produce";

  return {
    answered: itemIds.filter((id) => answeredItemIds.has(id)).length,
    areaId: payload.areaId,
    areas: payload.areas,
    brainPower: block.brainPower,
    canDo: block.canDo,
    canTestOut:
      block.kind === "learn" &&
      payload.chapterId !== null &&
      !blockedTestOutChapters.has(payload.chapterId),
    capsules: payload.capsules.map((capsule) => ({
      format: capsule.format,
      key: capsule.key,
      lessonId: capsule.lessonId,
      opened: capsule.itemIds.some((id) => answeredItemIds.has(id)),
      questions: capsule.itemIds.length,
      title: capsule.title,
    })),
    chapterId: payload.chapterId,
    checkpoint: toViewCheckpoint(payload.checkpoint),
    estimatedBrainPower: estimateBrainPower(getEstimateOutcome(block)),
    estimatedMinutes: block.estimatedMinutes ?? 0,
    extra: payload.extra,
    fullReview: payload.fullReview,
    kind: block.kind,
    lesson: null,
    lessonId: block.lessonId,
    mistakesOnly:
      block.kind === "practice" && payload.drills.length > 0 && payload.itemIds.length === 0,
    ...(payload.mockPreparationReview && { mockPreparationReview: true }),
    netScored: payload.netScored,
    oftenTested: teaches && payload.skillIds.some((skillId) => oftenTestedSkillIds.has(skillId)),
    opensInPlayer: false,
    planItemId: payload.planItemId,
    planItemKey: payload.planItemKey,
    position: block.position,
    practiceNumber: getPracticeNumber({ block, blocks }),
    preparing,
    questions: getBlockQuestions(block, payload.checkpoint, itemIds.length),
    refresh: payload.refresh,
    reinforcement: payload.reinforcement,
    screen: getBlockScreen(block),
    status: block.status,
    subject,
    subjectExtra,
    title: payload.title ?? payload.capsules[0]?.title ?? null,
    topics: payload.topics,
    waitReason: getStoredBlockWait({ block, blocks }),
    weakest: payload.weakest,
    ...getWritingFields({ answeredAttemptIds, block, payload, savedWritingTasks, writingTasks }),
  };
}
