import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type MemberCoverage,
  checkMemberCoverage,
} from "@zoonk/ai/tasks/curriculum/member-coverage";
import { type CourseLevel, prisma, sql } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../library/_utils/library-rows";
import {
  type CurriculumAnalytics,
  type CurriculumScope,
} from "../library/curriculum/curriculum-scope";
import { type MemberPlacement, placeUncoveredOf } from "../library/curriculum/place-list-members";
import { resolveScopeSkills } from "../library/curriculum/resolve-lesson-skills";
import { type PlanContext } from "./_utils/plan-context";
import { type AddedSkill } from "./plan-contract";
import { type PlanGraph, planGraphSchema } from "./planner/plan-state";
import { proposePlanChange } from "./propose-plan-change";

const OWED_PLANS_PER_SWEEP = 200;

const DEFAULT_LEVEL: CourseLevel = "beginner";

/** Says the change came from checking the plan against the complete list its goal names. @internal */
export const MEMBER_CHECK_SOURCE = "memberCheck";

type GraphSkill = PlanGraph["skills"][number];

export type ClaimedMemberCheck = {
  /** When the check was claimed; an offer from this claim or after it is never made twice. */
  checkedAt: Date;
  goalId: string;
  /** The plan's skills are the learner's own, so the members it adds stay theirs too. */
  ownSkills: boolean;
  planId: string;
  skills: GraphSkill[];
  userId: string;
};

export type PlanMemberCheck = { coverage: MemberCoverage; provenance: LibraryProvenance };

/** What the member check reads, written the way the checked graph was. */
export type MemberCheckRequest = {
  analytics: NonNullable<CurriculumAnalytics>;
  goal: string;
  language: string;
};

/**
 * A plan still owes its check while it's unmarked and the check could add to it: a signed-up
 * learner's active learn goal, with a graph, not built from material they uploaded.
 */
const OWES_MEMBER_CHECK = sql`
  plan.members_checked_at IS NULL
  AND goal.kind = 'learn'
  AND goal.status = 'active'
  AND NOT learner.is_anonymous
  AND jsonb_array_length(COALESCE(plan.graph -> 'skills', '[]'::jsonb)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM goal_sources source
    WHERE source.goal_id = goal.id AND source.origin = 'upload'
  )
`;

/** Internal bridge for the daily sweep: the plans whose graph still owes its member check. */
export async function listPlansOwingMemberCheck(): Promise<string[]> {
  const plans = await prisma.$queryRaw<{ id: string }[]>`
    SELECT plan.id
    FROM plans plan
    JOIN goals goal ON goal.id = plan.goal_id
    JOIN users learner ON learner.id = goal.user_id
    WHERE ${OWES_MEMBER_CHECK}
    ORDER BY plan.id DESC
    LIMIT ${OWED_PLANS_PER_SWEEP}
  `;

  return plans.map((plan) => plan.id);
}

async function hasOwnSkills({ skills, userId }: { skills: readonly GraphSkill[]; userId: string }) {
  const owned = await prisma.skill.count({
    where: { id: { in: skills.map((skill) => skill.skillId) }, ownerId: userId },
  });

  return owned > 0;
}

/**
 * Internal workflow bridge: marks the plan's graph checked before anything is spent, so a second
 * run, a retry after an offer or a dismissed offer never pays for the check again. Null when another
 * run or a new build already marked it, or the plan no longer owes it.
 */
export async function claimMemberCheck(planId: string): Promise<ClaimedMemberCheck | null> {
  const checkedAt = new Date();

  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE plans plan
    SET members_checked_at = ${checkedAt}
    FROM goals goal
    JOIN users learner ON learner.id = goal.user_id
    WHERE plan.id = ${planId}::uuid
      AND goal.id = plan.goal_id
      AND ${OWES_MEMBER_CHECK}
    RETURNING plan.id
  `;

  if (claimed.length === 0) {
    return null;
  }

  const plan = await prisma.plan.findUniqueOrThrow({
    select: { goal: { select: { id: true, userId: true } }, graph: true },
    where: { id: planId },
  });

  const { skills } = planGraphSchema.parse(plan.graph);
  const { userId } = plan.goal;

  return {
    checkedAt,
    goalId: plan.goal.id,
    ownSkills: await hasOwnSkills({ skills, userId }),
    planId,
    skills,
    userId,
  };
}

/**
 * Internal workflow bridge for one step: the goal's list, with each member's skills as the graph's
 * skill ids. Short keys keep the model from copying long ids into every member's row.
 */
export async function checkPlanMembers({
  claimed,
  request,
}: {
  claimed: ClaimedMemberCheck;
  request: MemberCheckRequest;
}): Promise<PlanMemberCheck> {
  const idsByKey = new Map(claimed.skills.map((skill, index) => [`s${index + 1}`, skill.skillId]));

  const { data, provenance } = await checkMemberCoverage({
    ...request,
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
 * Internal workflow bridge for one step: the Library skill for each uncovered member, in the scope
 * the goal's skills live in, placed beside its neighbors in the plan.
 */
export async function toMemberSkills({
  analytics,
  check,
  claimed,
  scope,
}: {
  analytics: NonNullable<CurriculumAnalytics>;
  check: PlanMemberCheck;
  claimed: ClaimedMemberCheck;
  scope: CurriculumScope;
}): Promise<AddedSkill[]> {
  const placed = placeMembers({ check, claimed });

  if (placed.length === 0) {
    return [];
  }

  const levels = await loadLevels(placed.map((member) => member.neighborSkill.skillId));

  const skillIds = await resolveScopeSkills({
    analytics,
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

/** An offer is made once per claim, so a retried step never brings back one the learner declined. */
async function wasOffered(claimed: ClaimedMemberCheck): Promise<boolean> {
  const offered = await prisma.planChange.count({
    where: {
      createdAt: { gte: claimed.checkedAt },
      payload: { equals: MEMBER_CHECK_SOURCE, path: ["source"] },
      planId: claimed.planId,
    },
  });

  return offered > 0;
}

/**
 * The offer fits only the graph the check read: a rebuild since then runs its own check, and its
 * new skills would leave the offer's anchors pointing nowhere.
 */
function hasClaimedGraph({
  claimed,
  context,
}: {
  claimed: ClaimedMemberCheck;
  context: PlanContext;
}) {
  const current = context.state.graph.skills;

  return (
    current.length === claimed.skills.length &&
    current.every((skill, index) => skill.skillId === claimed.skills[index]?.skillId)
  );
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
  if (skills.length === 0 || (await wasOffered(claimed))) {
    return;
  }

  await proposePlanChange({
    approval: "always",
    goalId: claimed.goalId,
    isDue: (context) => hasClaimedGraph({ claimed, context }),
    operations: [{ kind: "addSkills", skills }],
    provenance: toProvenanceData(check.provenance),
    // With no reason, the learner still sees which skills it adds.
    reason: check.coverage.reason ?? "",
    source: MEMBER_CHECK_SOURCE,
  });
}
