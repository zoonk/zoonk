import "server-only";
import { prisma } from "@zoonk/db";
import { loadListeningSkillIds } from "../../exams/listening/listening-skills";
import { loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getSkippedSkillIds } from "../../sessions/_utils/review-skills";
import { getBlockItemIds, readBlockPayload } from "../../sessions/block-payload";
import { loadSkillSubjects } from "../../view-models/syllabus/_utils/load-syllabus";
import { type ChallengeTopic } from "../challenge-contract";
import { getBossQuestionSkills, getBossSize } from "../checkpoint-minutes";
import { getBossSkillIds } from "../checkpoint-rules";
import { loadBossBankFacts } from "./load-boss-bank-facts";
import { type ChallengeBlock, type OwnedChallenge, isLanguageCall } from "./owned-challenge";

/**
 * The skills a phase's checkpoint asks before its block is built, as the session picks them
 * (`loadSessionBosses`): its phase's skills without the areas the learner took out, with the
 * goal's skills heard only through recordings.
 */
async function planBossSkills(
  challenge: OwnedChallenge,
): Promise<{ listeningSkillIds: Set<string>; skillIds: string[] }> {
  const { goal, item, items, plan } = challenge;
  const graph = parsePlanGraph(plan.graph);

  const [goalPlan, listeningSkillIds] = await Promise.all([
    loadGoalPlan(goal.id),
    loadListeningSkillIds(goal.id),
  ]);

  const skipped = getSkippedSkillIds({ graph, settings: plan.settings });

  const skillIds = getBossSkillIds({
    boss: item,
    graphSkills: graph.skills,
    itemSkillIds: new Map(goalPlan.items.map((planItem) => [planItem.id, planItem.skillIds])),
    items,
    skills: goalPlan.skills.filter((skill) => !skipped.has(skill.id)),
  });

  return { listeningSkillIds, skillIds };
}

/** The skills a phase's checkpoint's questions are on before its block is built. */
async function planBossSkillIds(challenge: OwnedChallenge): Promise<string[]> {
  return getBossQuestionSkills(await planBossSkills(challenge)).skillIds;
}

/**
 * What a phase's checkpoint asks and runs before its block is built, as the plan keeps it (see
 * `getBossSize`): null while it can't be asked yet (a listening phase short of voiced recordings).
 */
export async function planBossSize(
  challenge: OwnedChallenge,
): Promise<{ minutes: number; questions: number } | null> {
  const { listeningSkillIds, skillIds } = await planBossSkills(challenge);

  const facts = await loadBossBankFacts({
    examBlueprintId: challenge.goal.examBlueprintId,
    listeningSkillIds,
    skillIds,
    userId: challenge.userId,
  });

  return getBossSize({ facts, goalKind: challenge.goal.kind, listeningSkillIds, skillIds });
}

/**
 * The skills of the questions a built block asks, in its skills' order; its skills while its
 * questions are still to be written.
 */
async function loadBlockSkillIds(block: ChallengeBlock): Promise<string[]> {
  const payload = readBlockPayload(block);
  const itemIds = getBlockItemIds(payload);

  if (itemIds.length === 0) {
    return payload.skillIds;
  }

  const items = await prisma.item.findMany({
    select: { skillId: true },
    where: { id: { in: itemIds } },
  });

  const asked = new Set(items.map((item) => item.skillId));
  return payload.skillIds.filter((skillId) => asked.has(skillId));
}

/**
 * The skills a duel asks: its questions', once the session built its block; before that, a phase
 * checkpoint's as the plan sets them, which its questions will come from. The week's challenge
 * asks the week's skills, unknown before its block.
 */
async function loadAskedSkillIds({
  block,
  challenge,
}: {
  block: ChallengeBlock | null;
  challenge: OwnedChallenge;
}): Promise<string[]> {
  if (block) {
    return loadBlockSkillIds(block);
  }

  return challenge.item.kind === "boss" ? planBossSkillIds(challenge) : [];
}

/** The skills' names by id; a skill no longer in the Library has none. */
async function nameSkills(skillIds: readonly string[]): Promise<Map<string, string>> {
  const skills = await prisma.skill.findMany({
    select: { id: true, name: true },
    where: { id: { in: [...skillIds] } },
  });

  return new Map(skills.map((skill) => [skill.id, skill.name]));
}

/**
 * What a duel asks about (a phase's checkpoint, the week's challenge): the topics its questions
 * come from, in plan order, each with its subject's short name where the goal has several (see
 * `loadSkillSubjects`). A mock lists its sections instead, and a language goal's call asks none.
 */
export async function loadChallengeTopics({
  block,
  challenge,
}: {
  block: ChallengeBlock | null;
  challenge: OwnedChallenge;
}): Promise<ChallengeTopic[]> {
  if (challenge.item.kind === "mock" || isLanguageCall(challenge)) {
    return [];
  }

  const [skillIds, subjects] = await Promise.all([
    loadAskedSkillIds({ block, challenge }),
    loadSkillSubjects(challenge.goal),
  ]);

  const names = await nameSkills(skillIds);

  return skillIds.flatMap((skillId) => {
    const name = names.get(skillId);
    return name ? [{ name, subject: subjects.get(skillId) ?? null }] : [];
  });
}
