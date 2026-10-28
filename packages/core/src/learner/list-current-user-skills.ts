import "server-only";
import { type LearnerSkill, type Skill, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { type GoalSkillNode } from "./_utils/goal-skill-graph";
import { readGoalPlan } from "./_utils/read-goal-plan";
import { type SkillStatus, toSkillStatus } from "./_utils/skill-status";
import { type SkillListInput } from "./contract";
import { getRequestInstant } from "./facts/request-instant";
import { getOwnedGoal } from "./get-owned-goal";
import { type SkillStateCounts, countSkillStates } from "./mastery-state";

type SkillCard = SkillStatus &
  Pick<Skill, "description" | "example" | "name"> & {
    areaId: string | null;
    areaTitle: string | null;
    sectionTitle: string | null;
    skillId: string;
  };

export type CurrentUserSkills =
  | { counts: SkillStateCounts; skills: SkillCard[]; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

type SkillText = Pick<Skill, "description" | "example" | "id" | "name">;

function matchesFilter(card: SkillCard, filter: SkillListInput["filter"]): boolean {
  if (!filter || filter === "all") {
    return true;
  }

  return filter === "fading" ? card.fading : card.state === filter;
}

function toCard({
  learnerSkill,
  node,
  now,
  skill,
}: {
  learnerSkill: LearnerSkill | undefined;
  node: GoalSkillNode | null;
  now: Date;
  skill: SkillText;
}): SkillCard {
  return {
    ...toSkillStatus({ learnerSkill, now }),
    areaId: node?.areaId ?? null,
    areaTitle: node?.areaTitle ?? null,
    description: skill.description,
    example: skill.example,
    name: skill.name,
    sectionTitle: node?.sectionTitle ?? null,
    skillId: skill.id,
  };
}

const skillTextSelect = { description: true, example: true, id: true, name: true } as const;

async function loadGoalCards({
  goalId,
  now,
  userId,
}: {
  goalId: string;
  now: Date;
  userId: string;
}) {
  const { skills: nodes } = await readGoalPlan(goalId);
  const skillIds = nodes.map((node) => node.id);

  const [skills, learnerSkills] = await Promise.all([
    prisma.skill.findMany({ select: skillTextSelect, where: { id: { in: skillIds } } }),
    prisma.learnerSkill.findMany({ where: { skillId: { in: skillIds }, userId } }),
  ]);

  return nodes.flatMap((node) => {
    const skill = skills.find((candidate) => candidate.id === node.id);
    const learnerSkill = learnerSkills.find((row) => row.skillId === node.id);

    return skill ? [toCard({ learnerSkill, node, now, skill })] : [];
  });
}

async function loadAllCards({ now, userId }: { now: Date; userId: string }) {
  const learnerSkills = await prisma.learnerSkill.findMany({
    include: { skill: { select: skillTextSelect } },
    orderBy: { skill: { name: "asc" } },
    where: { userId },
  });

  return learnerSkills.map(({ skill, ...learnerSkill }) =>
    toCard({ learnerSkill, node: null, now, skill }),
  );
}

/** A goal includes every plan skill in plan order, including New; without one, includes only started skills. */
export async function listCurrentUserSkills(input: SkillListInput): Promise<CurrentUserSkills> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  cacheTag(getLearnerModelCacheTag(userId));

  if (input.goalId) {
    const owned = await getOwnedGoal(input.goalId);

    if (owned.status !== "ready") {
      return owned;
    }
  }

  const now = await getRequestInstant();

  const cards = input.goalId
    ? await loadGoalCards({ goalId: input.goalId, now, userId })
    : await loadAllCards({ now, userId });

  return {
    counts: countSkillStates(cards),
    skills: cards.filter((card) => matchesFilter(card, input.filter)),
    status: "ready",
  };
}
