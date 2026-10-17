import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { pickExamOptions } from "../../exams/choices/choose-exam-option";
import { splitDailyBudget } from "../../goals/daily-budget";
import { type GoalUpdateInput } from "../../goals/goal-contract";
import { updateGoal } from "../../goals/update-goal";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { scheduleMemoryUpdate } from "../../memory/update-memory-from-activity";
import { settleNewPlan } from "../../plans/_utils/recommended-bases";
import { updateLearningProfile } from "../../profile/update-learning-profile";
import { type OnboardingAnswerInput } from "./onboarding-contract";
import { getAnsweredQuestions, getFollowUpQuestions, readExamTarget } from "./onboarding-steps";

export type OnboardingAnswerResult = { status: "invalid" | "notFound" | "saved" | "unauthorized" };

/** The buddy belongs to the learner, not the goal, so it's saved on the profile. */
async function saveProfileAnswer(input: OnboardingAnswerInput): Promise<"invalid" | "saved"> {
  if (input.question !== "buddy") {
    return "saved";
  }

  const result = await updateLearningProfile({ buddy: input.buddy });
  return result.status === "updated" ? "saved" : "invalid";
}

/**
 * The options the learner takes of their exam's choices go with their plan, which studies only
 * those; "decide later" (no picks) leaves the choice for the plan.
 */
async function saveExamChoices({
  goal,
  input,
}: {
  goal: Goal;
  input: OnboardingAnswerInput;
}): Promise<"invalid" | "saved"> {
  if (input.question !== "examChoice" || !input.choices) {
    return "saved";
  }

  const result = await pickExamOptions({
    choices: input.choices,
    followToday: false,
    goal,
    timeZone: input.timeZone,
  });

  return result.status === "applied" ? "saved" : "invalid";
}

type Details = Record<string, unknown>;

/** What the level question stores: the level the learner gave, or the subjects they know well. */
const LEVEL_ANSWER_KEYS = new Set(["knownSubjects", "level"]);

/**
 * The details an answer builds on. A new level answer replaces the last one whole: an IELTS learner
 * who went back to "None of them yet" kept the Listening and Reading they had ticked, and the plan
 * skipped their basics.
 */
function withoutReplacedAnswer({
  details,
  input,
}: {
  details: Details;
  input: OnboardingAnswerInput;
}): Details {
  return input.question === "level"
    ? Object.fromEntries(Object.entries(details).filter(([key]) => !LEVEL_ANSWER_KEYS.has(key)))
    : details;
}

/** Only the answers the learner gave: skipped fields add nothing. */
function compactAnswers(answers: Record<string, string | null | undefined>): Details {
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => value));
}

/**
 * Where the target answer goes: the position a civil service exam ranks for and the score a test reports
 * are the goal's own fields, which research and the plan read; a course and score together stay
 * in the learner's words.
 */
function getTargetField(details: Details): "targetNote" | "targetPosition" | "targetScore" {
  switch (readExamTarget(details)) {
    case "position":
      return "targetPosition";
    case "score":
      return "targetScore";
    case "admission":
    case null:
      return "targetNote";
    default:
      return "targetNote";
  }
}

/** What each answer adds to the goal's understood details. Skipped answers add nothing. */
function getDetailChanges({
  details,
  input,
}: {
  details: Details;
  input: OnboardingAnswerInput;
}): Details {
  switch (input.question) {
    case "purpose":
      return { purpose: input.purpose };
    case "role":
      return compactAnswers({
        role: input.role,
        targetPosition: input.targetPosition,
        tasks: input.tasks,
      });
    case "reason":
      return input.reason ? { reason: input.reason } : {};
    case "target":
      return input.target ? { [getTargetField(details)]: input.target } : {};
    case "followUps":
      return {
        followUps: getFollowUpQuestions(details).map((question, index) => ({
          answer: input.answers[index] ?? null,
          question,
        })),
      };
    case "level":
      return {
        ...(input.level ? { level: input.level } : {}),
        ...(input.knownSubjects?.length ? { knownSubjects: input.knownSubjects } : {}),
      };
    case "buddy":
    case "examChoice":
    case "placement":
    case "schedule":
    case "targetDate":
      return {};
    default:
      return {};
  }
}

/** The schedule and date answers change the plan itself, so they go through the goal's update. */
function getScheduleChanges(input: OnboardingAnswerInput): Omit<GoalUpdateInput, "details"> {
  if (input.question === "targetDate") {
    return { targetDate: input.targetDate };
  }

  if (input.question === "schedule") {
    return {
      studyDays: input.studyDays,
      timeZone: input.timeZone,
      weekendMinutes: input.weekendMinutes,
    };
  }

  return {};
}

/** Goals typed together share the day's time: the main one gets the bigger share. */
async function shareDailyMinutes({
  dailyMinutes,
  goal,
}: {
  dailyMinutes: number;
  goal: Goal;
}): Promise<Map<string, number>> {
  const onboardingId = isJsonObject(goal.details) ? goal.details.onboardingId : null;

  const goals =
    typeof onboardingId === "string"
      ? await prisma.goal.findMany({
          orderBy: { createdAt: "asc" },
          select: { id: true },
          where: { details: { equals: onboardingId, path: ["onboardingId"] }, userId: goal.userId },
        })
      : [{ id: goal.id }];

  const shares = splitDailyBudget({ budget: dailyMinutes, count: goals.length });

  return new Map(goals.map((item, index) => [item.id, shares[index] ?? dailyMinutes]));
}

type ScheduleAnswer = Extract<OnboardingAnswerInput, { question: "schedule" }>;

/**
 * Other goals of the same onboarding take their share of the day's time (and of the weekend's)
 * and the same days. Returns this goal's share of both.
 */
async function updateSharedGoals({ goal, input }: { goal: Goal; input: ScheduleAnswer }) {
  const [shares, weekendShares] = await Promise.all([
    shareDailyMinutes({ dailyMinutes: input.dailyMinutes, goal }),
    input.weekendMinutes === undefined
      ? null
      : shareDailyMinutes({ dailyMinutes: input.weekendMinutes, goal }),
  ]);

  const others = [...shares].filter(([id]) => id !== goal.id);

  await Promise.all(
    others.map(([goalId, dailyMinutes]) =>
      updateGoal({
        goalId,
        input: {
          ...getScheduleChanges(input),
          dailyMinutes,
          weekendMinutes: weekendShares?.get(goalId),
        },
      }),
    ),
  );

  return {
    dailyMinutes: shares.get(goal.id) ?? input.dailyMinutes,
    weekendMinutes: weekendShares?.get(goal.id) ?? input.weekendMinutes,
  };
}

/**
 * Saves one onboarding answer for the learner's new goal: understood details, the goal's date,
 * its schedule (which re-plans, splits the day's time between goals typed together and lets
 * memory learn from the onboarding), or the learner's buddy. Every question answered or skipped is
 * remembered on the goal, so onboarding never asks it twice.
 */
export async function answerOnboardingQuestion({
  goalId,
  input,
}: {
  goalId: string;
  input: OnboardingAnswerInput;
}): Promise<OnboardingAnswerResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned;

  const [profile, choices] = await Promise.all([
    saveProfileAnswer(input),
    saveExamChoices({ goal, input }),
  ]);

  if (profile !== "saved" || choices !== "saved") {
    return { status: "invalid" };
  }

  const details = isJsonObject(goal.details) ? goal.details : {};
  const answered = [...new Set([...getAnsweredQuestions(details), input.question])];

  const shared = input.question === "schedule" ? await updateSharedGoals({ goal, input }) : null;

  const result = await updateGoal({
    goalId,
    input: {
      ...getScheduleChanges(input),
      dailyMinutes: shared?.dailyMinutes,
      details: {
        ...withoutReplacedAnswer({ details, input }),
        ...getDetailChanges({ details, input }),
        answered,
      },
      weekendMinutes: shared?.weekendMinutes,
    },
  });

  if (result.status !== "updated") {
    return result.status === "limitReached" ? { status: "invalid" } : { status: result.status };
  }

  // The daily time is onboarding's last question: the new plan settles (studying everything after
  // the exam when the learner chose it, its bases on the recommendation for their time), and
  // everything the learner said about themselves is on the goal, so what they said can
  // personalize their first lessons (unless memory is off).
  if (input.question === "schedule") {
    await settleNewPlan({ fullCourse: input.fullCourse, goalId });

    scheduleMemoryUpdate({
      goalId,
      source: { goalId, kind: "onboarding" },
      timeZone: input.timeZone,
      userId: goal.userId,
    });
  }

  return { status: "saved" };
}
