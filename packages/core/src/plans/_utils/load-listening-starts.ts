import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { loadListeningExam } from "../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../exams/listening/listening-skills";
import { getKnownSubjects, getOwnLevel } from "../../learner/placement/placement-contract";
import { type PlacementSkill } from "../../learner/placement/placement-graph";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { type PlanGraph, parsePlanGraph, parsePlanSettings } from "../planner/plan-state";
import { getLevelFloor } from "./level-bands";
import {
  getPlacementConfirmedBand,
  pickListeningPastBasicsAreas,
  pickPlacementListeningAreas,
} from "./level-listening-starts";
import { parsePlanChangePayload } from "./plan-change-payload";

/** The areas whose start the learner already chose in the plan (`setAreaStart`), either way. */
async function listChosenStartAreas(
  planId: string,
  tx: TransactionClient = prisma,
): Promise<Set<string>> {
  const changes = await tx.planChange.findMany({
    select: { payload: true },
    where: {
      payload: { array_contains: [{ kind: "setAreaStart" }], path: ["operations"] },
      planId,
      status: "applied",
    },
  });

  return new Set(
    changes.flatMap((change) =>
      parsePlanChangePayload(change.payload).operations.flatMap((operation) =>
        operation.kind === "setAreaStart" ? operation.areas : [],
      ),
    ),
  );
}

/**
 * `pickListeningPastBasicsAreas` for a plan, reading the exam's listening skills and the starts
 * the learner chose only when their word could start one past the basics.
 */
export async function listListeningPastBasicsAreas({
  goal,
  graph,
  planId,
}: {
  goal: Pick<Goal, "details" | "id">;
  graph: PlanGraph;
  planId: string;
}): Promise<string[]> {
  if (getLevelFloor(getOwnLevel({ goal })) === null && getKnownSubjects(goal).length === 0) {
    return [];
  }

  const exam = await loadListeningExam(goal.id);
  const listening = getListeningSkillIds({ exam, graph });

  if (listening.size === 0) {
    return [];
  }

  const chosen = await listChosenStartAreas(planId);
  return pickListeningPastBasicsAreas({ chosen, goal, graph, listening });
}

/** The skills among these the learner ever answered wrong or said they don't know yet. */
async function listMissedSkillIds({
  skillIds,
  userId,
  tx = prisma,
}: {
  skillIds: readonly string[];
  userId: string;
  tx?: TransactionClient;
}): Promise<Set<string>> {
  const missed = await tx.attempt.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: { isCorrect: false, skillId: { in: [...skillIds] }, userId },
  });

  return new Set(missed.flatMap((attempt) => attempt.skillId ?? []));
}

/**
 * `pickPlacementListeningAreas` for a goal whose placement took `knownSkillIds` as known among its
 * text skills (`skills`), leaving out the areas already past their basics.
 */
export async function listPlacementListeningAreas({
  goalId,
  knownSkillIds,
  skills,
  userId,
  tx = prisma,
}: {
  goalId: string;
  knownSkillIds: readonly string[];
  skills: readonly Pick<PlacementSkill, "band" | "id">[];
  userId: string;
  tx?: TransactionClient;
}): Promise<string[]> {
  if (knownSkillIds.length === 0) {
    return [];
  }

  const [plan, exam] = await Promise.all([
    tx.plan.findUnique({ select: { graph: true, id: true, settings: true }, where: { goalId } }),
    loadListeningExam(goalId, tx),
  ]);

  const graph = parsePlanGraph(plan?.graph);
  const listening = getListeningSkillIds({ exam, graph });

  if (!plan || listening.size === 0) {
    return [];
  }

  const text = skills.filter((skill) => !listening.has(skill.id));

  const confirmedBand = getPlacementConfirmedBand({
    knownSkillIds: new Set(knownSkillIds),
    missedSkillIds: await listMissedSkillIds({
      skillIds: text.map((skill) => skill.id),
      tx,
      userId,
    }),
    skills: text,
  });

  if (!confirmedBand) {
    return [];
  }

  const [prerequisites, bands, chosen] = await Promise.all([
    loadSkillPrerequisites(
      graph.skills.map((skill) => skill.skillId),
      tx,
    ),
    tx.skill.findMany({ select: { id: true, level: true }, where: { id: { in: [...listening] } } }),
    listChosenStartAreas(plan.id, tx),
  ]);

  const { pastBasicsAreas } = parsePlanSettings(plan.settings);

  return pickPlacementListeningAreas({
    bands: new Map(bands.map((skill) => [skill.id, skill.level])),
    chosen,
    confirmedBand,
    graph,
    listening,
    prerequisites,
  }).filter((area) => !pastBasicsAreas.includes(area));
}
