import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { pickExamOptions } from "../../exams/choices/choose-exam-option";
import { moveLanguageGoalToExam } from "../../exams/move-language-goal";
import { splitDailyBudget } from "../../goals/daily-budget";
import { type GoalUpdateInput, type GoalView } from "../../goals/goal-contract";
import { updateGoal } from "../../goals/update-goal";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { scheduleMemoryUpdate } from "../../memory/update-memory-from-activity";
import { settleNewPlan } from "../../plans/_utils/recommended-bases";
import { updateLearningProfile } from "../../profile/update-learning-profile";
import { type OnboardingAnswerInput } from "./onboarding-contract";
import { getAnsweredQuestions, getFollowUpQuestions, readExamTarget } from "./onboarding-steps";

/**
 * A saved answer says which goal onboarding goes on with: `movedTo` is the exam goal a language
 * goal moved to ("Pass an exam" naming a certificate), null when the goal stays.
 */
export type OnboardingAnswerResult =
  | { movedTo: GoalView | null; status: "saved" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** The buddy belongs to the learner, not the goal, so it's saved on the profile. */
async function saveProfileAnswer(input: OnboardingAnswerInput): Promise<"invalid" | "saved"> {
  if (input.question !== "buddy") {
    return "saved";
  }

  const result = await updateLearningProfile({ buddy: input.buddy });
  return result.status === "updated" ? "saved" : "invalid";
}

/** No picks means decide later; selected options restrict what the plan studies. */
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

const LEVEL_ANSWER_KEYS = new Set(["knownSubjects", "level"]);

/** Replacing a level answer must clear old known subjects, including a return to None of them yet. */
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

function compactAnswers(answers: Record<string, string | null | undefined>): Details {
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => value));
}

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

/** Goals from one onboarding share daily time, with the main goal receiving the larger share. */
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

/** Applies shared weekday/weekend schedules and returns this goal's allocation. */
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

/** Requires an owned goal; remembers skipped answers too, and schedule answers settle its plan and shared time. A language goal whose reason names a certificate moves to an exam goal for it. */
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

  // Schedule is last: personalization can read all answers and the age-based memory choice before first lessons.
  if (input.question === "schedule") {
    await settleNewPlan({ fullCourse: input.fullCourse, goalId });

    scheduleMemoryUpdate({
      goalId,
      source: { goalId, kind: "onboarding" },
      timeZone: input.timeZone,
      userId: goal.userId,
    });
  }

  // "Pass an exam" inside a language goal: a reason naming a certificate moves it to an exam goal.
  if (input.question === "reason" && goal.kind === "language") {
    const moved = await moveLanguageGoalToExam(goalId);
    return { movedTo: moved.status === "moved" ? moved.goal : null, status: "saved" };
  }

  return { movedTo: null, status: "saved" };
}
