import "server-only";
import { type Goal } from "@zoonk/db";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../../language/conversations/conversation-rules";
import { type GoalSkillNode } from "../../learner/_utils/goal-skill-graph";
import { getItemKey } from "../../plans/planner/plan-items";
import { type PlanSettings } from "../../plans/planner/plan-state";
import { type SessionPlanItem } from "../../sessions/_utils/session-plan-item";
import { type PlannedCheckpoint, type PlannedLesson } from "../../sessions/session-builder";
import { getBossQuestionSkills, getCheckpointMinutes } from "../checkpoint-minutes";
import {
  MIN_CHECKPOINT_QUESTIONS,
  getBossSkillIds,
  getPassMark,
  getPlannedQuestions,
  selectCheckpointItems,
} from "../checkpoint-rules";
import { findSessionBosses } from "./boss-reached";
import { loadBossRecordingItems } from "./boss-recordings";
import { loadCheckpointCandidates } from "./checkpoint-candidates";
import { loadResultReinforcement } from "./checkpoint-reinforcement";
import { findLastCheckpointResult } from "./checkpoint-results";
import { arePhaseChallengesRequired } from "./phase-challenge-access";

type SessionBoss = { checkpoint: PlannedCheckpoint | null; reinforcement: PlannedLesson[] };

/** Today's bosses, the earlier phase's first, and the lessons before a rematch among them. */
type SessionBosses = { checkpoints: PlannedCheckpoint[]; reinforcement: PlannedLesson[] };

const NO_BOSS: SessionBoss = { checkpoint: null, reinforcement: [] };

/** The last boss of the plan, in its last phase, is the final boss that closes the plan. */
export function isFinalBoss({
  boss,
  items,
}: {
  boss: SessionPlanItem;
  items: readonly SessionPlanItem[];
}): boolean {
  const lastPhase = Math.max(...items.map((item) => item.phase));
  const laterBoss = items.some((item) => item.kind === "boss" && item.position > boss.position);

  return boss.phase === lastPhase && !laterBoss;
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
  const asked = getBossQuestionSkills({ listeningSkillIds, skillIds });

  if (asked.recordings) {
    const itemIds = await loadBossRecordingItems({
      examBlueprintId,
      skillIds: asked.skillIds,
      userId,
    });

    return { itemIds, skillIds: asked.skillIds };
  }

  const candidates = await loadCheckpointCandidates({
    examBlueprintId,
    skillIds: asked.skillIds,
    userId,
  });

  return {
    itemIds: selectCheckpointItems({ candidates, skillIds: asked.skillIds }),
    skillIds: asked.skillIds,
  };
}

type BossInput = {
  /** The goal's exam: its questions and general ones make the checkpoint, never another exam's. */
  examBlueprintId: string | null;
  goal: Pick<Goal, "kind" | "targetDate">;
  settings: Pick<PlanSettings, "fullCourse">;
  /** The plan graph's skills, whose lessons size each skill's core (see `getBossSkillIds`). */
  graphSkills: readonly { lessons: number; skillId: string }[];
  /** Each plan item's skills, by its id, for a phase with no skills of its own. */
  itemSkillIds: ReadonlyMap<string, readonly string[]>;
  items: readonly SessionPlanItem[];
  /** The goal's skills practiced only with recordings (`getListeningSkillIds`). */
  listeningSkillIds?: ReadonlySet<string>;
  skills: readonly GoalSkillNode[];
  today: Date;
  userId: string;
};

/**
 * Today's bosses (see `findSessionBosses`): each ten mixed questions from its phase, traps first,
 * or its recordings for a phase heard only through them (see `loadBossQuestions`). A duel lost on
 * an earlier day comes back as a rematch after up to two available lessons on what it missed; a duel lost
 * today waits for tomorrow, and so do the later phases' challenges.
 */
export async function loadSessionBosses(input: BossInput): Promise<SessionBosses> {
  if (!(await arePhaseChallengesRequired({ goalKind: input.goal.kind, userId: input.userId }))) {
    return { checkpoints: [], reinforcement: [] };
  }

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
  goal,
  settings,
  graphSkills,
  itemSkillIds,
  items,
  listeningSkillIds = new Set(),
  skills,
  today,
  userId,
}: BossInput & { boss: SessionPlanItem }): Promise<SessionBoss> {
  const result = boss.id ? await findLastCheckpointResult({ planItemId: boss.id, userId }) : null;

  if (result && !result.passed && result.localDate.getTime() === today.getTime()) {
    return NO_BOSS;
  }

  const skillIds = getBossSkillIds({
    boss,
    goal,
    graphSkills,
    itemSkillIds,
    items,
    settings,
    skills,
  });

  // A language goal's boss is the unit's live call: it has goals to get across, not questions.
  if (goal.kind === "language") {
    return {
      checkpoint: {
        itemIds: [],
        kind: isFinalBoss({ boss, items }) ? "finalBoss" : "boss",
        minutes: CHECKPOINT_CALL_BLOCK_MINUTES,
        mock: false,
        passMark: 0,
        phase: boss.phase,
        planItemId: boss.id,
        planItemKey: getItemKey(boss),
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

  const questions = getPlannedQuestions(itemIds.length);

  return {
    checkpoint: {
      itemIds,
      kind: isFinalBoss({ boss, items }) ? "finalBoss" : "boss",
      minutes: getCheckpointMinutes(questions),
      mock: false,
      passMark: getPassMark(questions),
      phase: boss.phase,
      planItemId: boss.id,
      planItemKey: getItemKey(boss),
      rematch: result !== null,
      skillIds: asked.skillIds,
      timeLimitMinutes: null,
      title: boss.titleSnapshot,
    },
    reinforcement: await loadResultReinforcement({ result, userId }),
  };
}
