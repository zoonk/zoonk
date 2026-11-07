import "server-only";
import { type findActiveSubscription } from "../../auth/subscription";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../../language/conversations/conversation-rules";
import { type GoalSkillNode } from "../../learner/_utils/goal-skill-graph";
import { getItemKey } from "../../plans/planner/plan-items";
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
import { type ChallengePlan, findSessionBosses } from "./boss-reached";
import { loadBossRecordingItems } from "./boss-recordings";
import { loadCheckpointCandidates } from "./checkpoint-candidates";
import { loadResultReinforcement } from "./checkpoint-reinforcement";
import { findLastCheckpointResult } from "./checkpoint-results";
import { arePhaseChallengesRequired } from "./phase-challenge-access";

type SessionBoss = { checkpoint: PlannedCheckpoint | null; reinforcement: PlannedLesson[] };

type SessionBosses = { checkpoints: PlannedCheckpoint[]; reinforcement: PlannedLesson[] };

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

type BossInput = ChallengePlan<SessionPlanItem> & {
  examBlueprintId: string | null;
  readSubscription?: typeof findActiveSubscription;
  skills: readonly GoalSkillNode[];
  today: Date;
  userId: string;
};

export async function loadSessionBosses(input: BossInput): Promise<SessionBosses> {
  const { goal, readSubscription, userId } = input;

  if (!(await arePhaseChallengesRequired({ goalKind: goal.kind, readSubscription, userId }))) {
    return { checkpoints: [], reinforcement: [] };
  }

  const [first, ...later] = findSessionBosses({ plan: input, today: input.today });
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
    skills,
    targetDate: goal.targetDate,
  });

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
