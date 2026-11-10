import "server-only";
import { type Goal } from "@zoonk/db";
import { type findActiveSubscription } from "../../auth/subscription";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../../language/conversations/conversation-rules";
import { type GoalSkillNode } from "../../learner/_utils/goal-skill-graph";
import { getItemKey } from "../../plans/planner/plan-items";
import { type PlanGraphSkill, type PlanPhase } from "../../plans/planner/plan-state";
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
import { loadBossRecordingItems } from "./boss-recordings";
import { isChallengeReached } from "./challenge-reach";
import { loadCheckpointCandidates } from "./checkpoint-candidates";
import { loadResultReinforcement } from "./checkpoint-reinforcement";
import { findLastCheckpointResult } from "./checkpoint-results";
import { arePhaseChallengesRequired } from "./phase-challenge-access";

type SessionBoss = { checkpoint: PlannedCheckpoint | null; reinforcement: PlannedLesson[] };

type SessionBosses = { checkpoints: PlannedCheckpoint[] };

const NO_BOSS: SessionBoss = { checkpoint: null, reinforcement: [] };

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
  ahead?: ReadonlySet<string>;
  goal: Pick<Goal, "kind" | "targetDate">;
  graphSkills: readonly PlanGraphSkill[];
  itemSkillIds: ReadonlyMap<string, readonly string[]>;
  items: readonly SessionPlanItem[];
  listeningSkillIds: ReadonlySet<string>;
  phases: readonly PlanPhase[];
  paceFactor?: number;
  examBlueprintId: string | null;
  readSubscription?: typeof findActiveSubscription;
  skills: readonly GoalSkillNode[];
  today: Date;
  userId: string;
};

export async function loadSessionBosses(input: BossInput): Promise<SessionBosses> {
  const { goal, readSubscription, userId } = input;

  if (!(await arePhaseChallengesRequired({ goalKind: goal.kind, readSubscription, userId }))) {
    return { checkpoints: [] };
  }

  const loaded = await Promise.all(
    input.items
      .filter((item) => isChallengeReached({ ahead: input.ahead, boss: item, items: input.items }))
      .map((boss) => loadBoss({ ...input, boss })),
  );

  return {
    checkpoints: loaded.flatMap((entry) =>
      entry.checkpoint ? [{ ...entry.checkpoint, reinforcement: entry.reinforcement }] : [],
    ),
  };
}

function isUnwritable({
  listeningSkillIds,
  skillIds,
}: {
  listeningSkillIds: ReadonlySet<string>;
  skillIds: readonly string[];
}): boolean {
  return skillIds.every((skillId) => listeningSkillIds.has(skillId));
}

async function loadBoss({
  boss,
  examBlueprintId,
  goal,
  graphSkills,
  itemSkillIds,
  items,
  listeningSkillIds,
  paceFactor,
  phases,
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
    graphSkills,
    itemSkillIds,
    items,
    phases,
    skills,
    targetDate: goal.targetDate,
  });

  if (skillIds.length === 0) {
    return NO_BOSS;
  }

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
    reinforcement: await loadResultReinforcement({ paceFactor, result, userId }),
  };
}
