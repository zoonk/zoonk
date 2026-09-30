import "server-only";
import { type Goal } from "@zoonk/db";
import { listCurrentUserSkills } from "../../learner/list-current-user-skills";
import { type SkillStateCounts } from "../../learner/mastery-state";
import { getWeeklyRecap } from "../../milestones/get-weekly-recap";
import { listCurrentUserMistakes } from "../../mistakes/list-current-user-mistakes";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { loadStillNeededWork } from "../../preparation/_utils/load-still-needed-work";
import {
  type GoalPreparationResult,
  getGoalPreparation,
} from "../../preparation/get-goal-preparation";
import { type StillNeeded, buildStillNeeded } from "../../preparation/still-needed";
import { groupSkillsByArea, listFadingSkills } from "../_utils/group-skills";
import { resolveViewGoal } from "../_utils/resolve-view-goal";

/** Fading skills worth a look now, most faded first: enough to act on, never a wall of red. */
const MAX_FADING_SKILLS = 5;

type Preparation = Extract<GoalPreparationResult, { status: "ready" }>["preparation"];

/** "Functions and graphs: 3 of 8 mastered, 1 fading". */
type ProgressChapter = { areaId: string; counts: SkillStateCounts; title: string };

type FadingSkill = { name: string; retrievability: number | null; skillId: string };

/** The week against the learner's own last week, and the skill that moved the most. */
type ProgressWeek = {
  comparison: { days: number; minutes: number; questions: number };
  days: number;
  minutes: number;
  questions: number;
  turnaround: {
    from: number;
    name: string;
    reason: "gold" | "practice" | "solid";
    to: number;
  } | null;
};

/**
 * Progress for one goal, the same numbers in Focus (bars and lists) and Fun (the preparation ring
 * and area planets): preparation with the evidence behind each part, what's still needed to reach
 * the goal, mastery per chapter, the skills fading now and this week's summary. The estimated
 * score exists only after a mock.
 */
export type ProgressView = {
  chapters: ProgressChapter[];
  fading: FadingSkill[];
  goal: Pick<Goal, "id" | "kind" | "title"> & { targetDate: string | null };
  /** Open entries in the mistakes notebook, which Progress links to. */
  mistakes: { open: number };
  /** Null for a quick explanation: one answer, not a goal to prepare for. */
  preparation: Preparation | null;
  /** "Still needed to reach your goal": the skills below their bar by area, with the plan's time. */
  stillNeeded: StillNeeded;
  week: ProgressWeek | null;
};

export type ProgressViewResult =
  | { progress: ProgressView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

type Recap = Extract<Awaited<ReturnType<typeof getWeeklyRecap>>, { status: "ready" }>["recap"];

function toWeek(recap: Recap): ProgressWeek {
  return {
    comparison: recap.comparison,
    days: recap.week.daysStudied.length,
    minutes: recap.week.minutes,
    questions: recap.week.questions,
    turnaround: recap.turnaround
      ? {
          from: recap.turnaround.from,
          name: recap.turnaround.name,
          reason: recap.turnaround.reason,
          to: recap.turnaround.to,
        }
      : null,
  };
}

/** Progress for a goal (the active goal by default). */
export async function getProgressView(
  input: { goalId?: string } = {},
): Promise<ProgressViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;

  const isExplanation = goal.kind === "explain";

  const [preparation, skills, recap, mistakes, work] = await Promise.all([
    isExplanation ? null : getGoalPreparation(goal.id),
    listCurrentUserSkills({ goalId: goal.id }),
    getWeeklyRecap({ goalId: goal.id }),
    listCurrentUserMistakes({ goalId: goal.id, limit: 1, offset: 0 }),
    loadStillNeededWork({ goalId: goal.id, now: new Date() }),
  ]);

  if ((preparation && preparation.status !== "ready") || skills.status !== "ready") {
    return { status: "notFound" };
  }

  return {
    progress: {
      chapters: groupSkillsByArea(skills.skills).map(({ areaId, counts, title }) => ({
        areaId,
        counts,
        title,
      })),
      fading: listFadingSkills(skills.skills).slice(0, MAX_FADING_SKILLS),
      goal: {
        id: goal.id,
        kind: goal.kind,
        targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
        title: goal.title,
      },
      mistakes: { open: mistakes.status === "ready" ? mistakes.counts.open : 0 },
      preparation: preparation?.status === "ready" ? preparation.preparation : null,
      stillNeeded: buildStillNeeded({
        goalKind: goal.kind,
        skills: isExplanation ? [] : skills.skills,
        ...work,
      }),
      week: recap.status === "ready" ? toWeek(recap.recap) : null,
    },
    status: "ready",
  };
}
