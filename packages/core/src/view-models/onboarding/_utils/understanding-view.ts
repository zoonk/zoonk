import "server-only";
import {
  type GoalUnderstanding,
  type UnderstoodGoal,
} from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadTargetCutoff } from "../../../exams/cutoffs/load-target-cutoff";
import { type GoalDraft } from "../../../goals/goal-contract";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { type GoalUnderstandingView, type UnderstoodGoalView } from "../onboarding-contract";
import { findExamFacts } from "./exam-facts";

/** A gentle start when the words don't say: "Even 15 minutes makes a difference". */
const DEFAULT_DAILY_MINUTES = 15;

/** The words a draft holds, with the draft's id for the goals created from it. */
export type UnderstandingContext = {
  goal: string;
  language: string;
  onboardingId: string;
  today: string;
  /** The learner the draft is for, so an exam date lookup counts toward their cost. */
  userId: string;
  /** Asked before an exam's day is searched for on the web (see `allowDateSearch`). */
  allowDateSearch?: () => Promise<boolean>;
};

type DetailValue = NonNullable<GoalDraft["details"]>[string];

/** The learner's own date, so "this year" and "in March" read from where they are. */
export function getLearnerToday(timeZone: string): string {
  return toIsoDate(getDateInTimeZone({ date: new Date(), timeZone }));
}

/** Facts the words didn't give are left out of the goal's details instead of stored as null. */
function compactDetails(details: Record<string, DetailValue | undefined>) {
  return Object.fromEntries(
    Object.entries(details).filter(
      (entry): entry is [string, DetailValue] => entry[1] !== undefined,
    ),
  );
}

/** What the words already answered, so onboarding doesn't ask it again. */
function getAnsweredByWords(understanding: Extract<GoalUnderstanding, { route: "goals" }>) {
  return understanding.dailyMinutes === undefined ? [] : ["schedule"];
}

async function toGoalView({
  answered,
  context,
  followUps,
  goal,
  studyTimeNote,
}: {
  answered: string[];
  context: UnderstandingContext;
  followUps: string[];
  goal: UnderstoodGoal;
  studyTimeNote: string | undefined;
}): Promise<UnderstoodGoalView> {
  const { language, onboardingId, today } = context;

  const exam =
    goal.kind === "exam" && goal.examName
      ? await findExamFacts({
          allowSearch: context.allowDateSearch,
          analytics: { contentScope: "personal", distinctId: context.userId },
          exam: {
            examMonth: goal.examMonth,
            examName: goal.examName,
            examYear: goal.examYear,
            institution: goal.institution,
            role: goal.targetPosition,
            words: context.goal,
          },
          language,
          // A day the learner gave is theirs: nothing to look up.
          lookUpDate: !goal.targetDate,
          today,
        })
      : null;

  const details = compactDetails({
    answered,
    examMonth: goal.examMonth,
    examName: goal.examName,
    examTarget: goal.examTarget,
    examYear: goal.examYear,
    followUps: followUps.map((question) => ({ answer: null, question })),
    institution: goal.institution,
    level: goal.ownLevel,
    levelNote: goal.level,
    nativeLanguage: goal.nativeLanguage,
    onboardingId,
    purpose: goal.purpose,
    reason: goal.reason,
    role: goal.role,
    studyTimeNote,
    subject: goal.subject,
    targetCourse: goal.targetCourse,
    targetPosition: goal.targetPosition,
    targetScore: goal.targetScore,
  });

  // Another learner's research may already know the target's last cut-off: a read, never a lookup.
  const cutoff = await loadTargetCutoff({ details, examBlueprintId: exam?.blueprintId });

  return {
    cutoff,
    draft: {
      details,
      examBlueprintId: exam?.blueprintId ?? undefined,
      kind: goal.kind,
      language,
      prompt: context.goal,
      targetDate: goal.targetDate ?? exam?.targetDate ?? undefined,
      targetLanguage: goal.targetLanguage,
      title: goal.title,
    },
    examDates: exam?.dates ?? [],
  };
}

async function toGoalsView({
  context,
  understanding,
}: {
  context: UnderstandingContext;
  understanding: Extract<GoalUnderstanding, { route: "goals" }>;
}): Promise<GoalUnderstandingView> {
  const answered = getAnsweredByWords(understanding);
  const { studyTimeNote } = understanding;
  const [main, ...others] = understanding.goals;

  /** Follow-ups are about the main goal, the one onboarding continues with. */
  const goals = await Promise.all([
    ...(main
      ? [
          toGoalView({
            answered,
            context,
            followUps: understanding.followUps,
            goal: main,
            studyTimeNote,
          }),
        ]
      : []),
    ...others.map((goal) => toGoalView({ answered, context, followUps: [], goal, studyTimeNote })),
  ]);

  return {
    goals,
    schedule: {
      dailyMinutes: understanding.dailyMinutes ?? DEFAULT_DAILY_MINUTES,
      studyDays: understanding.studyDays ?? null,
      studyTime: understanding.studyTime ?? null,
      studyTimeNote: understanding.studyTimeNote ?? null,
    },
    status: "goals",
  };
}

/**
 * What the learner sees of an understanding: goals to plan with every fact the words already give
 * (an exam's dates for the year they named come from its stored notice, with their source, or
 * are estimated), a quick question, an instrument, or something unsafe or too vague.
 */
export async function toUnderstandingView({
  context,
  understanding,
}: {
  context: UnderstandingContext;
  understanding: GoalUnderstanding;
}): Promise<GoalUnderstandingView> {
  switch (understanding.route) {
    case "explain":
      return { question: understanding.question, status: "explain" };
    case "instrument":
      return { instrument: understanding.instrument, status: "instrument" };
    case "goals":
      return toGoalsView({ context, understanding });
    case "unclear":
    case "unsafe":
      return { status: understanding.route };
    default:
      return { status: "unclear" };
  }
}
