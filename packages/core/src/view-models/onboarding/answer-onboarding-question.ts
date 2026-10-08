import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { splitDailyBudget } from "../../goals/daily-budget";
import { type GoalUpdateInput } from "../../goals/goal-contract";
import { updateGoal } from "../../goals/update-goal";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { scheduleMemoryUpdate } from "../../memory/update-memory-from-activity";
import { updateMemorySettings } from "../../memory/update-memory-settings";
import { type LearningProfileUpdateInput } from "../../profile/learning-profile-contract";
import { updateLearningProfile } from "../../profile/update-learning-profile";
import { type OnboardingAnswerInput } from "./onboarding-contract";
import { getAnsweredQuestions, getFollowUpQuestions, readExamTarget } from "./onboarding-steps";

export type OnboardingAnswerResult = {
  status: "accountDeleted" | "invalid" | "notFound" | "saved" | "unauthorized";
};

function getProfileUpdate(input: OnboardingAnswerInput): LearningProfileUpdateInput | null {
  switch (input.question) {
    case "age":
      return input.birth ? { birth: input.birth } : null;
    case "buddy":
      return { buddy: input.buddy };
    case "followUps":
    case "level":
    case "memory":
    case "placement":
    case "purpose":
    case "reason":
    case "role":
    case "schedule":
    case "target":
    case "targetDate":
      return null;
    default:
      return null;
  }
}

/**
 * Age, memory and buddy belong to the learner, not the goal, so they're saved on the profile. The
 * memory answer is the learner's own choice, the same as the switch in Settings; a guardian's
 * "memory off" still wins over a yes.
 */
async function saveProfileAnswer(
  input: OnboardingAnswerInput,
): Promise<"accountDeleted" | "invalid" | "saved"> {
  if (input.question === "memory") {
    const result = await updateMemorySettings({ enabled: input.enabled });
    return result.status === "updated" ? "saved" : "invalid";
  }

  const update = getProfileUpdate(input);

  if (!update) {
    return "saved";
  }

  const result = await updateLearningProfile(update);

  if (result.status === "accountDeleted") {
    return "accountDeleted";
  }

  return result.status === "updated" ? "saved" : "invalid";
}

type Details = Record<string, unknown>;

/** Only the answers the learner gave: skipped fields add nothing. */
function compactAnswers(answers: Record<string, string | null | undefined>): Details {
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => value));
}

/**
 * Where the target answer goes: the position a concurso ranks for and the score a test reports
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
    case "age":
    case "buddy":
    case "memory":
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
    return input.targetDate ? { targetDate: input.targetDate } : {};
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
 * memory learn from the onboarding), or the learner's age and buddy. Every question answered or skipped is remembered on the goal, so
 * onboarding never asks it twice. An age under 13 deletes the account, goal included.
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

  const profile = await saveProfileAnswer(input);

  if (profile !== "saved") {
    return { status: profile };
  }

  const { goal } = owned;
  const details = isJsonObject(goal.details) ? goal.details : {};
  const answered = [...new Set([...getAnsweredQuestions(details), input.question])];

  const shared = input.question === "schedule" ? await updateSharedGoals({ goal, input }) : null;

  const result = await updateGoal({
    goalId,
    input: {
      ...getScheduleChanges(input),
      dailyMinutes: shared?.dailyMinutes,
      details: { ...details, ...getDetailChanges({ details, input }), answered },
      weekendMinutes: shared?.weekendMinutes,
    },
  });

  if (result.status !== "updated") {
    return result.status === "limitReached" ? { status: "invalid" } : { status: result.status };
  }

  // The daily time is onboarding's last question: everything the learner said about themselves
  // is on the goal, and their age (or their own answer) has decided whether memory is on, so what
  // they said can personalize their first lessons. Memory respects "off" and minors' limits.
  if (input.question === "schedule") {
    scheduleMemoryUpdate({
      goalId,
      source: { goalId, kind: "onboarding" },
      timeZone: input.timeZone,
      userId: goal.userId,
    });
  }

  return { status: "saved" };
}
