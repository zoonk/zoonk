import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type MemberCoverage,
  checkMemberCoverage,
} from "@zoonk/ai/tasks/curriculum/member-coverage";
import { type CourseLevel, prisma } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../library/_utils/library-rows";
import { type MemberPlacement, placeUncoveredOf } from "../library/curriculum/place-list-members";
import { resolveScopeSkills } from "../library/curriculum/resolve-lesson-skills";
import { loadTopicScope } from "./_utils/plan-topics";
import { type AddedSkill } from "./plan-contract";
import { type PlanGraph, planGraphSchema } from "./planner/plan-state";
import { proposePlanChange } from "./propose-plan-change";

const OWED_PLANS_PER_SWEEP = 200;

const DEFAULT_LEVEL: CourseLevel = "beginner";

/** Says the change came from checking the plan against the complete list its goal names. */
export const MEMBER_CHECK_SOURCE = "memberCheck";

type GraphSkill = PlanGraph["skills"][number];

export type ClaimedMemberCheck = {
  goalId: string;
  goal: string;
  language: string;
  userId: string;
  skills: GraphSkill[];
};

export type PlanMemberCheck = { coverage: MemberCoverage; provenance: LibraryProvenance };

/**
 * Internal bridge for the daily sweep: active learn plans whose graph still owes its member check,
 * leaving out goals built from the learner's own material.
 */
export async function listPlansOwingMemberCheck(): Promise<string[]> {
  const plans = await prisma.$queryRaw<{ id: string }[]>`
    SELECT plan.id
    FROM plans plan
    JOIN goals goal ON goal.id = plan.goal_id
    WHERE plan.members_checked_at IS NULL
      AND goal.kind = 'learn'
      AND goal.status = 'active'
      AND jsonb_array_length(COALESCE(plan.graph -> 'skills', '[]'::jsonb)) > 0
      AND NOT EXISTS (
        SELECT 1 FROM goal_sources source
        WHERE source.goal_id = goal.id AND source.origin = 'upload'
      )
    ORDER BY plan.id DESC
    LIMIT ${OWED_PLANS_PER_SWEEP}
  `;

  return plans.map((plan) => plan.id);
}

/**
 * Internal workflow bridge: marks the plan's graph checked before anything is spent, so a second
 * run, a retry after an offer or a dismissed offer never pays for the check again. Null when another
 * run or a new build already marked it.
 */
export async function claimMemberCheck(planId: string): Promise<ClaimedMemberCheck | null> {
  const { count } = await prisma.plan.updateMany({
    data: { membersCheckedAt: new Date() },
    where: { id: planId, membersCheckedAt: null },
  });

  if (count === 0) {
    return null;
  }

  const plan = await prisma.plan.findUniqueOrThrow({
    select: {
      goal: { select: { id: true, language: true, prompt: true, userId: true } },
      graph: true,
    },
    where: { id: planId },
  });

  return {
    goal: plan.goal.prompt,
    goalId: plan.goal.id,
    language: plan.goal.language,
    skills: planGraphSchema.parse(plan.graph).skills,
    userId: plan.goal.userId,
  };
}

/**
 * Internal workflow bridge for one step: the goal's list, with each member's skills as the graph's
 * skill ids. Short keys keep the model from copying long ids into every member's row.
 */
export async function checkPlanMembers(claimed: ClaimedMemberCheck): Promise<PlanMemberCheck> {
  const idsByKey = new Map(claimed.skills.map((skill, index) => [`s${index + 1}`, skill.skillId]));

  const { data, provenance } = await checkMemberCoverage({
    analytics: { contentScope: "personal", distinctId: claimed.userId, goalId: claimed.goalId },
    goal: claimed.goal,
    language: claimed.language,
    serviceTier: chooseServiceTier({ wait: "later" }),
    skills: claimed.skills.map((skill, index) => ({ key: `s${index + 1}`, name: skill.name })),
  });

  const members = data.members.map((member) => ({
    ...member,
    skills: member.skills.flatMap((key) => idsByKey.get(key) ?? []),
  }));

  return { coverage: { ...data, members }, provenance };
}

type PlacedMember = MemberPlacement<MemberCoverage["uncovered"][number]> & {
  neighborSkill: GraphSkill;
};

function placeMembers({
  check,
  claimed,
}: {
  check: PlanMemberCheck;
  claimed: ClaimedMemberCheck;
}): PlacedMember[] {
  return placeUncoveredOf({
    members: check.coverage.members,
    order: claimed.skills.map((skill) => skill.skillId),
    uncovered: check.coverage.uncovered,
  }).flatMap((placement) => {
    const neighborSkill = claimed.skills[placement.neighbor];
    return neighborSkill ? [{ ...placement, neighborSkill }] : [];
  });
}

/**
 * `addSkills` places a skill before another, so a member after the graph's last skill goes just
 * before it.
 */
function toBeforeSkillId({ after, skills }: { after: number; skills: readonly GraphSkill[] }) {
  return (skills[after + 1] ?? skills.at(-1))?.skillId ?? null;
}

async function loadLevels(skillIds: readonly string[]): Promise<Map<string, CourseLevel>> {
  const skills = await prisma.skill.findMany({
    select: { id: true, level: true },
    where: { id: { in: [...skillIds] } },
  });

  return new Map(skills.flatMap((skill) => (skill.level ? [[skill.id, skill.level]] : [])));
}

/**
 * Internal workflow bridge for one step: the Library skill for each uncovered member, in the goal's
 * scope, placed beside its neighbors in the plan.
 */
export async function toMemberSkills({
  check,
  claimed,
}: {
  check: PlanMemberCheck;
  claimed: ClaimedMemberCheck;
}): Promise<AddedSkill[]> {
  const placed = placeMembers({ check, claimed });

  if (placed.length === 0) {
    return [];
  }

  const goal = await prisma.goal.findUniqueOrThrow({
    select: { language: true, primaryCourseId: true, targetLanguage: true },
    where: { id: claimed.goalId },
  });

  const [scope, levels] = await Promise.all([
    loadTopicScope(goal),
    loadLevels(placed.map((member) => member.neighborSkill.skillId)),
  ]);

  const skillIds = await resolveScopeSkills({
    analytics: { contentScope: "shared", distinctId: claimed.userId, goalId: claimed.goalId },
    provenance: check.provenance,
    scope,
    serviceTier: chooseServiceTier({ wait: "later" }),
    skills: placed.map((member) => ({
      description: member.item.description,
      level: levels.get(member.neighborSkill.skillId) ?? DEFAULT_LEVEL,
      name: member.item.name,
    })),
  });

  return placed.flatMap((member, index) => {
    const skillId = skillIds[index];
    const courseId = member.neighborSkill.courseIds?.[0];

    return skillId
      ? [
          {
            area: member.neighborSkill.area,
            beforeSkillId: toBeforeSkillId({ after: member.after, skills: claimed.skills }),
            ...(courseId && { courseId }),
            lessons: member.neighborSkill.lessons,
            name: member.item.name,
            skillId,
          },
        ]
      : [];
  });
}

/** Internal workflow bridge: asks the learner to add the members their plan leaves out. */
export async function offerMemberSkills({
  check,
  claimed,
  skills,
}: {
  check: PlanMemberCheck;
  claimed: ClaimedMemberCheck;
  skills: AddedSkill[];
}): Promise<void> {
  if (skills.length === 0) {
    return;
  }

  await proposePlanChange({
    approval: "always",
    goalId: claimed.goalId,
    operations: [{ kind: "addSkills", skills }],
    provenance: toProvenanceData(check.provenance),
    // With no reason, the learner still sees which skills it adds.
    reason: check.coverage.reason ?? "",
    source: MEMBER_CHECK_SOURCE,
  });
}
