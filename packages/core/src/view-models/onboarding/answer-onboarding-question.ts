import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { splitDailyBudget } from "../../goals/daily-budget";
import { type GoalUpdateInput } from "../../goals/goal-contract";
import { updateGoal } from "../../goals/update-goal";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { type LearningProfileUpdateInput } from "../../profile/learning-profile-contract";
import { updateLearningProfile } from "../../profile/update-learning-profile";
import { type OnboardingAnswerInput } from "./onboarding-contract";
import { getAnsweredQuestions, getFollowUpQuestions } from "./onboarding-steps";

export type OnboardingAnswerResult = {
  status: "accountDeleted" | "invalid" | "notFound" | "saved" | "unauthorized";
};

function getProfileUpdate(input: OnboardingAnswerInput): LearningProfileUpdateInput | null {
  switch (input.question) {
    case "age":
      return input.birth ? { birth: input.birth } : null;
    case "mode":
      return { experienceMode: input.experienceMode };
    case "buddy":
      return { buddy: input.buddy };
    case "followUps":
    case "level":
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

/** Age, mode and buddy belong to the learner, not the goal, so they're saved on the profile. */
async function saveProfileAnswer(
  input: OnboardingAnswerInput,
): Promise<"accountDeleted" | "invalid" | "saved"> {
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
      return input.target ? { targetNote: input.target } : {};
    case "followUps":
      return {
        followUps: getFollowUpQuestions(details).map((question, index) => ({
          answer: input.answers[index] ?? null,
          question,
        })),
      };
    case "level":
      return input.level ? { level: input.level } : {};
    case "age":
    case "mode":
    case "buddy":
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
      studyTime: input.studyTime ?? undefined,
      timeZone: input.timeZone,
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

/** Other goals of the same onboarding take their share of the day's time and the same days. */
async function updateSharedGoals({
  goal,
  input,
}: {
  goal: Goal;
  input: Extract<OnboardingAnswerInput, { question: "schedule" }>;
}) {
  const shares = await shareDailyMinutes({ dailyMinutes: input.dailyMinutes, goal });
  const others = [...shares].filter(([id]) => id !== goal.id);

  await Promise.all(
    others.map(([goalId, dailyMinutes]) =>
      updateGoal({ goalId, input: { dailyMinutes, ...getScheduleChanges(input) } }),
    ),
  );

  return shares.get(goal.id) ?? input.dailyMinutes;
}

/**
 * Saves one onboarding answer for the learner's new goal: understood details, the goal's date,
 * its schedule (which re-plans, and splits the day's time between goals typed together), or the
 * learner's age, mode and buddy. Every question answered or skipped is remembered on the goal, so
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

  const dailyMinutes =
    input.question === "schedule" ? await updateSharedGoals({ goal, input }) : undefined;

  const result = await updateGoal({
    goalId,
    input: {
      ...getScheduleChanges(input),
      dailyMinutes,
      details: { ...details, ...getDetailChanges({ details, input }), answered },
    },
  });

  if (result.status === "updated") {
    return { status: "saved" };
  }

  return result.status === "limitReached" ? { status: "invalid" } : { status: result.status };
}
