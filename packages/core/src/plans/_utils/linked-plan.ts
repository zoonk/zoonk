import "server-only";
import { prisma } from "@zoonk/db";
import { SETUP_SKILL_KEY_PREFIX } from "@zoonk/utils/identity-key";
import { type PlanLinkOutline } from "../plan-link-contract";
import { type PlanGraph } from "../planner/plan-state";

/** Never the owner's own answers: a link shows only these fields. */
export async function loadLinkedPlan(planId: string) {
  return prisma.plan.findUnique({
    select: {
      goal: {
        select: {
          examBlueprint: { select: { id: true, name: true, visibility: true } },
          id: true,
          kind: true,
          language: true,
          primaryCourse: { select: { description: true, id: true, title: true, visibility: true } },
          targetLanguage: true,
          userId: true,
        },
      },
      graph: true,
    },
    where: { id: planId },
  });
}

type LinkedPlan = NonNullable<Awaited<ReturnType<typeof loadLinkedPlan>>>;

export function getLinkSubject(goal: LinkedPlan["goal"]): PlanLinkOutline["subject"] {
  if (goal.examBlueprint?.visibility === "public") {
    return { description: null, title: goal.examBlueprint.name };
  }

  const course = goal.primaryCourse;

  return course?.visibility === "public"
    ? { description: course.description, title: course.title }
    : null;
}

export async function keepPublicGraph(graph: PlanGraph): Promise<PlanGraph> {
  const candidates = [...graph.skills, ...(graph.extraSkills ?? [])];

  const publicSkills = await prisma.skill.findMany({
    select: { id: true },
    where: {
      NOT: { identityKey: { startsWith: SETUP_SKILL_KEY_PREFIX } },
      id: { in: candidates.map((skill) => skill.skillId) },
      visibility: "public",
    },
  });

  const publicIds = new Set(publicSkills.map((skill) => skill.id));
  const isPublic = (skill: PlanGraph["skills"][number]) => publicIds.has(skill.skillId);
  const skills = graph.skills.filter((skill) => isPublic(skill) && !skill.extra);

  const kept = graph.phases.flatMap((phase, index) =>
    skills.some((skill) => skill.phase === index) ? [index] : [],
  );

  const extraSkills = graph.extraSkills
    ?.filter((skill) => isPublic(skill))
    .map((skill) => ({ ...skill, phase: Math.max(0, kept.length - 1) }));

  return {
    ...(extraSkills?.length && { extraSkills }),
    phases: kept.flatMap((index) => graph.phases[index] ?? []),
    skills: skills.map((skill) => ({ ...skill, phase: kept.indexOf(skill.phase) })),
  };
}
