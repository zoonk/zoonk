import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type GoalPlan, getSkillOwners } from "../../learner/_utils/goal-skill-graph";
import { fromIsoDate } from "../../plans/planner/plan-calendar";
import { type ClosedLivingPlanWindow, readLivingPlanWindow } from "./living-plan-window";

type SessionSignals = {
  easySkillIds: string[];
  hardRecheckSkillIds: string[];
  earlyReviewSkillIds: string[];
};

export async function loadLivingPlanSignals({
  goal,
  localDate,
  plan,
  timeZone,
}: {
  goal: Pick<Goal, "kind" | "livingPlanWindow" | "targetLanguage" | "userId">;
  localDate: Date;
  plan: {
    goalPlan: GoalPlan;
    previousSessionDate: Date | null;
    prerequisites: ReadonlyMap<string, readonly string[]>;
  };
  timeZone: string;
}): Promise<SessionSignals> {
  const { kind, targetLanguage } = goal;

  const rows =
    kind === "language" && targetLanguage
      ? await prisma.languageSkillLevel.findMany({
          select: { livingPlanWindow: true },
          where: { language: targetLanguage, userId: goal.userId },
        })
      : [goal];

  if (kind !== "learn" && kind !== "language") {
    return { earlyReviewSkillIds: [], easySkillIds: [], hardRecheckSkillIds: [] };
  }

  const due = rows
    .map(({ livingPlanWindow }) => readLivingPlanWindow(livingPlanWindow).closed)
    .filter((window): window is ClosedLivingPlanWindow => {
      if (!window) {
        return false;
      }

      const date = window.sessionDay
        ? fromIsoDate(window.sessionDay)
        : getDateInTimeZone({ date: new Date(window.at), timeZone });

      return date < localDate && (!plan.previousSessionDate || date >= plan.previousSessionDate);
    });

  return planSignals({ plan: plan.goalPlan, prerequisites: plan.prerequisites, windows: due });
}

/** Exported for its unit test only. @internal */
export function planSignals({
  plan,
  prerequisites,
  windows,
}: {
  plan: GoalPlan;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  windows: readonly ClosedLivingPlanWindow[];
}): SessionSignals {
  const active = new Set(plan.skills.flatMap((skill) => (skill.removed ? [] : [skill.id])));

  const skillsWithStatus = (status: GoalPlan["items"][number]["status"]) =>
    new Set(plan.items.flatMap((item) => (item.status === status ? item.skillIds : [])));

  const skipped = skillsWithStatus("testedOut");
  const studied = skillsWithStatus("done");
  const next = windows.some((window) => window.result === "easy") ? skillsWithStatus("todo") : [];
  const ownerOf = getSkillOwners(plan.skills);

  const gaps = new Set(
    windows.flatMap((window) =>
      window.result === "hard"
        ? window.missedSkillIds.flatMap(
            (skillId) => prerequisites.get(ownerOf.get(skillId) ?? skillId) ?? [],
          )
        : [],
    ),
  );

  return {
    earlyReviewSkillIds: [...gaps].filter((id) => active.has(id) && studied.has(id)),
    easySkillIds: [...next].filter((id) => active.has(id) && !skipped.has(id) && !studied.has(id)),
    hardRecheckSkillIds: [...gaps].filter(
      (id) => active.has(id) && skipped.has(id) && !studied.has(id),
    ),
  };
}
