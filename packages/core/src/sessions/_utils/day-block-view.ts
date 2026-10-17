import { type StudySessionBlock } from "@zoonk/db";
import { getPlannedQuestions } from "../../checkpoints/checkpoint-rules";
import { type BlockCheckpoint, getBlockItemIds, readBlockPayload } from "../block-payload";
import { getStoredBlockWait } from "../block-wait";
import { type BlockOutcome, EMPTY_OUTCOME, estimateBrainPower } from "../brain-power";
import { type DayBlockView } from "../day-view";

/** Planned work has no database ID; the stored block adds its real ID after persistence. */
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
  return checkpoint ? { ...checkpoint, mockIdentity: checkpoint.mockIdentity ?? null } : null;
}

export function toDayBlockView({
  answeredItemIds,
  block,
  blocks = [block],
  blockedTestOutChapters = NO_SKILLS,
  oftenTestedSkillIds = NO_SKILLS,
  subject = null,
}: {
  answeredItemIds: ReadonlySet<string>;
  block: DayBlockInput;
  blocks?: readonly DayBlockInput[];
  blockedTestOutChapters?: ReadonlySet<string>;
  /** The exam goal's skills its board asks a lot; empty for other goals. */
  oftenTestedSkillIds?: ReadonlySet<string>;
  /** The goal's subject the block studies, by its short name; null without one. */
  subject?: string | null;
}): DayBlockView {
  const payload = readBlockPayload(block);
  const itemIds = getBlockItemIds(payload);
  const teaches = block.kind === "learn" || block.kind === "practice" || block.kind === "produce";

  // A challenge judged by right answers (a language call has no pass mark) that the bank held too
  // few questions for asks its full ten once Start writes them (`getPlannedQuestions`).
  const { checkpoint } = payload;

  const waitsForQuestions =
    checkpoint !== null &&
    !checkpoint.mock &&
    checkpoint.passMark > 0 &&
    block.status === "pending";

  return {
    answered: itemIds.filter((id) => answeredItemIds.has(id)).length,
    areaId: payload.areaId,
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
    lessonId: block.lessonId,
    mistakesOnly:
      block.kind === "practice" && payload.drills.length > 0 && payload.itemIds.length === 0,
    netScored: payload.netScored,
    oftenTested: teaches && payload.skillIds.some((skillId) => oftenTestedSkillIds.has(skillId)),
    planItemId: payload.planItemId,
    planItemKey: payload.planItemKey,
    position: block.position,
    questions: waitsForQuestions ? getPlannedQuestions(itemIds.length) : itemIds.length,
    refresh: payload.refresh,
    reinforcement: payload.reinforcement,
    status: block.status,
    subject,
    title: payload.title ?? payload.capsules[0]?.title ?? null,
    waitReason: getStoredBlockWait({ block, blocks }),
    weakest: payload.weakest,
  };
}
