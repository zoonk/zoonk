import "server-only";
import { type Goal, type UserLearningProfile, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type findActiveSubscription } from "../../auth/subscription";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { hasPlanDeadline } from "../../plans/_utils/plan-end";
import { countPlannedLessonProgress } from "../../plans/_utils/planned-lesson-progress";
import { getSkillArea } from "../../plans/planner/graph-areas";
import { getWeekdayMinutes, toIsoDate } from "../../plans/planner/plan-calendar";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import {
  DAYS_PER_WEEK,
  parsePlanGraph,
  parsePlanPhases,
  parsePlanSettings,
} from "../../plans/planner/plan-state";
import { withSkills } from "../../view-models/syllabus/_utils/syllabus-content";
import {
  loadTestedOutLinks,
  withTestedOutSkills,
} from "../../view-models/syllabus/_utils/syllabus-known-skills";
import { type GoalCountryFields } from "../country-contract";
import { type GoalView } from "../goal-contract";
import { type loadRecentCountries } from "./country-suggestions";
import { loadGoalCountryViews } from "./goal-country-views";
import { getGoalLanguageFlag } from "./goal-language-flag";
import { getGoalRegionChoices } from "./goal-region";
import {
  type PlanPhaseFacts,
  getCurrentPhaseFromFacts,
  loadPlanPhaseFacts,
} from "./plan-phase-facts";

type PlanRow = { goalId: string; id: string; phases: unknown; settings: unknown; graph: unknown };

function getStudyDays({ dailyMinutes, settings }: { dailyMinutes: number; settings: unknown }) {
  const { weekdayMinutes } = parsePlanSettings(settings);

  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => weekday).filter(
    (weekday) => getWeekdayMinutes({ calendar: { dailyMinutes, weekdayMinutes }, weekday }) > 0,
  );
}

async function loadChallengeRequirements(
  facts: readonly PlanPhaseFacts[],
  readSubscription?: typeof findActiveSubscription,
) {
  const languageOwners = [
    ...new Set(facts.filter((plan) => plan.goalKind === "language").map((plan) => plan.userId)),
  ];

  const required = await Promise.all(
    languageOwners.map(
      async (userId) =>
        [
          userId,
          await arePhaseChallengesRequired({ goalKind: "language", readSubscription, userId }),
        ] as const,
    ),
  );

  return new Map(required);
}

export async function loadCurrentPhases(
  plans: readonly Pick<PlanRow, "id">[],
  readSubscription?: typeof findActiveSubscription,
): Promise<Map<string, number | null>> {
  const facts = await loadPlanPhaseFacts({ planIds: plans.map((plan) => plan.id) });
  const required = await loadChallengeRequirements(facts, readSubscription);

  return new Map(
    plans.map((plan) => {
      const planFacts = facts.find((row) => row.planId === plan.id);

      const phase = planFacts
        ? getCurrentPhaseFromFacts({
            facts: planFacts,
            phaseChallengesRequired:
              planFacts.goalKind !== "language" || (required.get(planFacts.userId) ?? true),
          })
        : null;

      return [plan.id, phase];
    }),
  );
}

async function loadPlanProgress(
  plans: readonly PlanRow[],
  goals: readonly Goal[],
  readSubscription?: typeof findActiveSubscription,
) {
  const planIds = plans.map((plan) => plan.id);

  const [lessons, ends, currentPhases] = await Promise.all([
    prisma.planItem
      .findMany({
        omit: { facts: true },
        where: { kind: { in: [...LEARN_KINDS] }, planId: { in: planIds } },
      })
      .then(async (items) => {
        const graphs = new Map(plans.map((plan) => [plan.id, parsePlanGraph(plan.graph)]));

        const skillIds = new Map(
          [...graphs].map(([id, graph]) => [
            id,
            new Set(graph.skills.map((skill) => skill.skillId)),
          ]),
        );

        const mapped = await withSkills({
          from: prisma,
          graphSkillIds: (item) => skillIds.get(item.planId) ?? new Set(),
          items,
        });

        const links = await loadTestedOutLinks(mapped);

        return new Map(
          await Promise.all(
            plans.map(async (plan) => {
              const graph = graphs.get(plan.id) ?? parsePlanGraph(null);
              const settings = parsePlanSettings(plan.settings);
              const goal = goals.find((row) => row.id === plan.goalId);

              const counts = countPlannedLessonProgress({
                deadline: hasPlanDeadline({
                  studiesPastTarget: goal?.kind === "exam" && settings.fullCourse,
                  targetDate: goal?.targetDate ?? null,
                }),
                items: await withTestedOutSkills({
                  graphSkillIds: skillIds.get(plan.id) ?? new Set(),
                  items: mapped.filter((item) => item.planId === plan.id),
                  links,
                }),
                skillAreas: new Map(
                  graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
                ),
                skippedAreas: settings.skippedAreas,
              });

              return [plan.goalId, counts] as const;
            }),
          ),
        );
      }),
    prisma.planItem.groupBy({
      _max: { scheduledFor: true },
      by: ["planId"],
      where: { planId: { in: planIds } },
    }),
    loadCurrentPhases(plans, readSubscription),
  ]);

  return { currentPhases, ends, lessons };
}

function toPlanSummary({
  plan,
  progress,
}: {
  plan: PlanRow;
  progress: Awaited<ReturnType<typeof loadPlanProgress>>;
}): GoalView["plan"] {
  const end = progress.ends.find((row) => row.planId === plan.id)?._max.scheduledFor ?? null;
  const phases = parsePlanPhases(plan.phases);

  return {
    currentPhase: progress.currentPhases.get(plan.id) ?? null,
    endDate: end ? toIsoDate(end) : null,
    lessonsDone:
      (progress.lessons.get(plan.goalId)?.lessonsDone ?? 0) +
      (progress.lessons.get(plan.goalId)?.lessonsKnown ?? 0),
    lessonsTotal: progress.lessons.get(plan.goalId)?.lessonsTotal ?? 0,
    phaseCount: phases.length,
    ready: phases.length > 0,
  };
}

function toGoalView({
  activeGoalId,
  countries,
  goal,
  plan,
  progress,
}: {
  activeGoalId: string | null;
  countries: GoalCountryFields;
  goal: Goal;
  plan: PlanRow | undefined;
  progress: Awaited<ReturnType<typeof loadPlanProgress>>;
}): GoalView {
  return {
    ...countries,
    createdAt: goal.createdAt.toISOString(),
    dailyMinutes: goal.dailyMinutes,
    details: isJsonObject(goal.details) ? goal.details : {},
    displayName: goal.displayName,
    examBlueprintId: goal.examBlueprintId,
    id: goal.id,
    isActive: goal.id === activeGoalId,
    kind: goal.kind,
    language: goal.language,
    languageFlag: getGoalLanguageFlag(goal),
    plan: plan ? toPlanSummary({ plan, progress }) : null,
    primaryCourseId: goal.primaryCourseId,
    prompt: goal.prompt,
    regionChoices: getGoalRegionChoices(goal),
    status: goal.status,
    studyDays: getStudyDays({ dailyMinutes: goal.dailyMinutes, settings: plan?.settings }),
    studyTime: goal.studyTime,
    targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    targetLanguage: goal.targetLanguage,
    targetRegion: goal.targetRegion,
    timezone: goal.timezone,
    title: goal.title,
  };
}

/** GET callers pass `readActiveSubscription` and `readRecentCountries`; writes read both fresh. */
export async function loadGoalViews({
  activeGoalId,
  goals,
  readRecentCountries,
  readSubscription,
}: {
  activeGoalId: string | null;
  goals: readonly Goal[];
  readRecentCountries?: typeof loadRecentCountries;
  readSubscription?: typeof findActiveSubscription;
}): Promise<GoalView[]> {
  const plans = await prisma.plan.findMany({
    select: { goalId: true, graph: true, id: true, phases: true, settings: true },
    where: { goalId: { in: goals.map((goal) => goal.id) } },
  });

  const [progress, countries] = await Promise.all([
    loadPlanProgress(plans, goals, readSubscription),
    loadGoalCountryViews({ goals, readRecentCountries }),
  ]);

  return countries.map(({ countries: countryView, goal }) =>
    toGoalView({
      activeGoalId,
      countries: countryView,
      goal,
      plan: plans.find((plan) => plan.goalId === goal.id),
      progress,
    }),
  );
}

export async function findActiveGoalId(
  userId: string,
  knownProfile?: Pick<UserLearningProfile, "activeGoalId"> | null,
): Promise<string | null> {
  const profile =
    knownProfile === undefined
      ? await prisma.userLearningProfile.findUnique({
          select: { activeGoalId: true },
          where: { userId },
        })
      : knownProfile;

  if (profile?.activeGoalId) {
    return profile.activeGoalId;
  }

  const first = await prisma.goal.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { status: "active", userId },
  });

  return first?.id ?? null;
}
