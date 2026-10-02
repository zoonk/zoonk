import "server-only";
import { type GoalKind, type PlanItem, prisma } from "@zoonk/db";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../../language/conversations/conversation-rules";
import { type GoalSkillNode } from "../../learner/_utils/goal-skill-graph";
import { loadLessonsForSkills } from "../../sessions/_utils/load-plan-lessons";
import { getBlockItemIds, readBlockPayload } from "../../sessions/block-payload";
import { type PlannedCheckpoint, type PlannedLesson } from "../../sessions/session-builder";
import {
  CHECKPOINT_MINUTES_PER_QUESTION,
  MIN_CHECKPOINT_QUESTIONS,
  REINFORCEMENT_LESSONS,
  getMissedSkills,
  getPassMark,
  selectCheckpointItems,
} from "../checkpoint-rules";
import { loadCheckpointCandidates } from "./checkpoint-candidates";
import { type CheckpointResult, findLastCheckpointResult } from "./checkpoint-results";

const LEARN_KINDS = new Set<PlanItem["kind"]>(["lesson", "chapter"]);

export type SessionBoss = { checkpoint: PlannedCheckpoint | null; reinforcement: PlannedLesson[] };

const NO_BOSS: SessionBoss = { checkpoint: null, reinforcement: [] };

/**
 * The boss that closes a phase is reached once every lesson before it in its phase is done, or
 * on the day the plan scheduled it.
 */
function findReachedBoss({ items, today }: { items: readonly PlanItem[]; today: Date }) {
  return items.find(
    (item) =>
      item.kind === "boss" &&
      item.status === "todo" &&
      ((item.scheduledFor !== null && item.scheduledFor <= today) ||
        items
          .filter(
            (other) =>
              other.position < item.position &&
              other.phase === item.phase &&
              LEARN_KINDS.has(other.kind),
          )
          .every((other) => other.status !== "todo")),
  );
}

/** The last boss of the plan, in its last phase, is the final boss that closes the plan. */
function isFinalBoss({ boss, items }: { boss: PlanItem; items: readonly PlanItem[] }): boolean {
  const lastPhase = Math.max(...items.map((item) => item.phase));
  const laterBoss = items.some((item) => item.kind === "boss" && item.position > boss.position);

  return boss.phase === lastPhase && !laterBoss;
}

/** The skills a lost duel missed, from the answers given in its block. */
async function loadMissedSkills({ result, userId }: { result: CheckpointResult; userId: string }) {
  if (!result.studySessionId || !result.studySessionBlockId) {
    return [];
  }

  const block = await prisma.studySessionBlock.findUnique({
    select: { id: true, payload: true },
    where: { id: result.studySessionBlockId },
  });

  const itemIds = block ? getBlockItemIds(readBlockPayload(block)) : [];

  // Answers saved in the same instant keep the order they were saved in (uuidv7 ids).
  const answers = await prisma.attempt.findMany({
    orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
    select: { isCorrect: true, skillId: true },
    where: { itemId: { in: itemIds }, studySessionId: result.studySessionId, userId },
  });

  return getMissedSkills(answers);
}

/**
 * Today's boss, if one is reached: ten mixed questions from its phase, traps first. A duel lost on
 * an earlier day comes back as a rematch after two short lessons on what it missed; a duel lost
 * today waits for tomorrow.
 */
export async function loadSessionBoss({
  examBlueprintId,
  goalKind,
  items,
  skills,
  today,
  userId,
}: {
  /** The goal's exam: its questions and general ones make the checkpoint, never another exam's. */
  examBlueprintId: string | null;
  goalKind: GoalKind;
  items: readonly PlanItem[];
  skills: readonly GoalSkillNode[];
  today: Date;
  userId: string;
}): Promise<SessionBoss> {
  const boss = findReachedBoss({ items, today });

  if (!boss) {
    return NO_BOSS;
  }

  const result = await findLastCheckpointResult({ planItemId: boss.id, userId });

  if (result && !result.passed && result.localDate.getTime() === today.getTime()) {
    return NO_BOSS;
  }

  const skillIds = skills.filter((skill) => skill.phase === boss.phase).map((skill) => skill.id);

  // A language goal's boss is the unit's live call: it has goals to get across, not questions.
  if (goalKind === "language") {
    return {
      checkpoint: {
        itemIds: [],
        kind: isFinalBoss({ boss, items }) ? "finalBoss" : "boss",
        minutes: CHECKPOINT_CALL_BLOCK_MINUTES,
        mock: false,
        passMark: 0,
        phase: boss.phase,
        planItemId: boss.id,
        rematch: result !== null,
        skillIds,
        timeLimitMinutes: null,
        title: boss.titleSnapshot,
      },
      reinforcement: [],
    };
  }

  const candidates = await loadCheckpointCandidates({ examBlueprintId, skillIds, userId });
  const itemIds = selectCheckpointItems({ candidates, skillIds });

  if (itemIds.length < MIN_CHECKPOINT_QUESTIONS) {
    return NO_BOSS;
  }

  const missed = result ? await loadMissedSkills({ result, userId }) : [];

  return {
    checkpoint: {
      itemIds,
      kind: isFinalBoss({ boss, items }) ? "finalBoss" : "boss",
      minutes: itemIds.length * CHECKPOINT_MINUTES_PER_QUESTION,
      mock: false,
      passMark: getPassMark(itemIds.length),
      phase: boss.phase,
      planItemId: boss.id,
      rematch: result !== null,
      skillIds,
      timeLimitMinutes: null,
      title: boss.titleSnapshot,
    },
    reinforcement: await loadLessonsForSkills({ limit: REINFORCEMENT_LESSONS, skillIds: missed }),
  };
}
