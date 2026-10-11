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
  getBossSkillIds,
  getMissedSkills,
  getPassMark,
  getPlannedQuestions,
  selectCheckpointItems,
} from "../checkpoint-rules";
import { loadBossRecordingItems } from "./boss-recordings";
import { loadCheckpointCandidates } from "./checkpoint-candidates";
import { type CheckpointResult, findLastCheckpointResult } from "./checkpoint-results";

const LEARN_KINDS = new Set<PlanItem["kind"]>(["lesson", "chapter"]);

type SessionBoss = { checkpoint: PlannedCheckpoint | null; reinforcement: PlannedLesson[] };

/** Today's bosses, the earlier phase's first, and the lessons before a rematch among them. */
type SessionBosses = { checkpoints: PlannedCheckpoint[]; reinforcement: PlannedLesson[] };

const NO_BOSS: SessionBoss = { checkpoint: null, reinforcement: [] };

/**
 * The boss that closes a phase is reached once every lesson before it in its phase is done, or
 * on the day the plan scheduled it. A phase with no lessons of its own (an exam's window of
 * practice and mocks) has nothing to finish first: its boss comes on its day.
 */
export function isBossReached({
  boss,
  items,
  today,
}: {
  boss: PlanItem;
  items: readonly PlanItem[];
  today: Date;
}): boolean {
  if (boss.kind !== "boss" || boss.status !== "todo") {
    return false;
  }

  if (boss.scheduledFor !== null && boss.scheduledFor <= today) {
    return true;
  }

  const lessons = items.filter(
    (other) =>
      other.position < boss.position && other.phase === boss.phase && LEARN_KINDS.has(other.kind),
  );

  return lessons.length > 0 && lessons.every((other) => other.status !== "todo");
}

/**
 * The bosses today's session duels: the first one reached, then any later phase's whose day is
 * today too, earlier phase first. A half-studied day left one phase's challenge, and the next
 * phase still ends today as the learner saw it (R6): asked alone, the first pushed the second a
 * day and moved that phase's end.
 */
function findSessionBosses({ items, today }: { items: readonly PlanItem[]; today: Date }) {
  const first = items.find((boss) => isBossReached({ boss, items, today }));

  if (!first) {
    return [];
  }

  const later = items.filter(
    (boss) =>
      boss.kind === "boss" &&
      boss.status === "todo" &&
      boss.phase > first.phase &&
      boss.scheduledFor !== null &&
      boss.scheduledFor <= today,
  );

  return [first, ...later.toSorted((a, b) => a.phase - b.phase)];
}

/** The last boss of the plan, in its last phase, is the final boss that closes the plan. */
export function isFinalBoss({
  boss,
  items,
}: {
  boss: PlanItem;
  items: readonly PlanItem[];
}): boolean {
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
 * What a boss asks on its phase's skills: ten mixed questions, traps first, on the ones text
 * questions can ask. A phase of skills practiced only with recordings (an exam's Listening) gets
 * whole recordings instead, played as strictly as a mock.
 */
export async function loadBossQuestions({
  examBlueprintId,
  listeningSkillIds,
  skillIds,
  userId,
}: {
  examBlueprintId: string | null;
  listeningSkillIds: ReadonlySet<string>;
  skillIds: readonly string[];
  userId: string;
}): Promise<{ itemIds: string[]; skillIds: string[] }> {
  const textSkillIds = skillIds.filter((skillId) => !listeningSkillIds.has(skillId));

  if (textSkillIds.length === 0) {
    const itemIds = await loadBossRecordingItems({ examBlueprintId, skillIds, userId });
    return { itemIds, skillIds: [...skillIds] };
  }

  const candidates = await loadCheckpointCandidates({
    examBlueprintId,
    skillIds: textSkillIds,
    userId,
  });

  return {
    itemIds: selectCheckpointItems({ candidates, skillIds: textSkillIds }),
    skillIds: textSkillIds,
  };
}

type BossInput = {
  /** The goal's exam: its questions and general ones make the checkpoint, never another exam's. */
  examBlueprintId: string | null;
  goalKind: GoalKind;
  /** The plan graph's skills, whose lessons size each skill's core (see `getBossSkillIds`). */
  graphSkills: readonly { lessons: number; skillId: string }[];
  /** Each plan item's skills, by its id, for a phase with no skills of its own. */
  itemSkillIds: ReadonlyMap<string, readonly string[]>;
  items: readonly PlanItem[];
  /** The goal's skills practiced only with recordings (`getListeningSkillIds`). */
  listeningSkillIds?: ReadonlySet<string>;
  skills: readonly GoalSkillNode[];
  today: Date;
  userId: string;
};

/**
 * Today's bosses (see `findSessionBosses`): each ten mixed questions from its phase, traps first,
 * or its recordings for a phase heard only through them (see `loadBossQuestions`). A duel lost on
 * an earlier day comes back as a rematch after two short lessons on what it missed; a duel lost
 * today waits for tomorrow, and so do the later phases' challenges.
 */
export async function loadSessionBosses(input: BossInput): Promise<SessionBosses> {
  const [first, ...later] = findSessionBosses(input);
  const head = first ? await loadBoss({ ...input, boss: first }) : NO_BOSS;

  if (!head.checkpoint) {
    return { checkpoints: [], reinforcement: [] };
  }

  const rest = await Promise.all(later.map((boss) => loadBoss({ ...input, boss })));
  const loaded = [head, ...rest];

  return {
    checkpoints: loaded.flatMap((entry) => (entry.checkpoint ? [entry.checkpoint] : [])),
    reinforcement: loaded.flatMap((entry) => entry.reinforcement),
  };
}

/**
 * Whether a boss's questions can't be written when it starts: a phase with no skills to ask, or
 * one heard only through recordings, which its listening sets make.
 */
function isUnwritable({
  listeningSkillIds,
  skillIds,
}: {
  listeningSkillIds: ReadonlySet<string>;
  skillIds: readonly string[];
}): boolean {
  return skillIds.every((skillId) => listeningSkillIds.has(skillId));
}

/**
 * One of today's bosses as the session asks it, or none when it can't be asked today. A boss the
 * bank holds too few questions for keeps its place, planned at its full size: its questions are
 * written when it starts (`fillCheckpointQuestions`).
 */
async function loadBoss({
  boss,
  examBlueprintId,
  goalKind,
  graphSkills,
  itemSkillIds,
  items,
  listeningSkillIds = new Set(),
  skills,
  today,
  userId,
}: BossInput & { boss: PlanItem }): Promise<SessionBoss> {
  const result = await findLastCheckpointResult({ planItemId: boss.id, userId });

  if (result && !result.passed && result.localDate.getTime() === today.getTime()) {
    return NO_BOSS;
  }

  const skillIds = getBossSkillIds({ boss, graphSkills, itemSkillIds, items, skills });

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

  const asked = await loadBossQuestions({ examBlueprintId, listeningSkillIds, skillIds, userId });
  const { itemIds } = asked;

  if (
    itemIds.length < MIN_CHECKPOINT_QUESTIONS &&
    isUnwritable({ listeningSkillIds, skillIds: asked.skillIds })
  ) {
    return NO_BOSS;
  }

  const missed = result ? await loadMissedSkills({ result, userId }) : [];
  const questions = getPlannedQuestions(itemIds.length);

  return {
    checkpoint: {
      itemIds,
      kind: isFinalBoss({ boss, items }) ? "finalBoss" : "boss",
      minutes: questions * CHECKPOINT_MINUTES_PER_QUESTION,
      mock: false,
      passMark: getPassMark(questions),
      phase: boss.phase,
      planItemId: boss.id,
      rematch: result !== null,
      skillIds: asked.skillIds,
      timeLimitMinutes: null,
      title: boss.titleSnapshot,
    },
    reinforcement: await loadLessonsForSkills({ limit: REINFORCEMENT_LESSONS, skillIds: missed }),
  };
}
