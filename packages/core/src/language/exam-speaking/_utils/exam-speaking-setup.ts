import "server-only";
import { SPEAKING_EXAM_LANGUAGES } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { type Goal, prisma } from "@zoonk/db";
import { type AllowanceLimit } from "../../../entitlements/contract";
import { getAllowance } from "../../../entitlements/get-allowance";
import { getSpeakingLevel } from "../../conversations/_utils/conversation-goal";
import { type SpeakingPaperView } from "../speaking-contract";
import { type SpeakingFormat } from "../speaking-format";
import { getSpeakingFormat } from "../speaking-formats";
import { getSpeakingExamGoal } from "../speaking-goal";
import { toSpeakingPaperView } from "../speaking-views";
import { loadLastTries } from "./speaking-last-tries";

export type ExamSpeakingSetup = { format: SpeakingFormat; goal: Goal };

const EXAM_LANGUAGES = Object.values(SPEAKING_EXAM_LANGUAGES);

/**
 * The speaking paper a goal prepares for, from its exam and level (`getSpeakingExamGoal`), with the
 * learner's speaking level standing in for a level nobody named.
 */
async function readGoalSpeakingFormat(
  goal: Goal & { examBlueprint?: { name: string } | null },
): Promise<SpeakingFormat | null> {
  if (!goal.targetLanguage || !EXAM_LANGUAGES.includes(goal.targetLanguage)) {
    return null;
  }

  const fallbackLevel = await getSpeakingLevel({
    goal,
    targetLanguage: goal.targetLanguage,
    userId: goal.userId,
  });

  const found = getSpeakingExamGoal({
    fallbackLevel,
    goal: { ...goal, blueprintName: goal.examBlueprint?.name },
  });

  return found ? getSpeakingFormat(found) : null;
}

/**
 * The speaking paper of the goal's exam as its exam or language page shows it, its tasks to start
 * one at a time with the learner's last try at each; `access` locks them without Plus. Null for
 * goals of other exams.
 */
export async function loadSpeakingPaper({
  access,
  goal,
}: {
  access: SpeakingPaperView["access"];
  goal: Goal & { examBlueprint?: { name: string } | null };
}): Promise<SpeakingPaperView | null> {
  const format = await readGoalSpeakingFormat(goal);

  if (!format) {
    return null;
  }

  const lastTries = await loadLastTries({ format, goal });
  return toSpeakingPaperView({ access, format, lastTries });
}

/**
 * The speaking paper a goal practices, named as Today offers it ("B1 Preliminary"), without its
 * tasks: `access` locks it without Plus. Null for goals of other exams and languages.
 */
export async function loadSpeakingPaperEntry({
  goal,
}: {
  goal: Goal & { examBlueprint?: { name: string } | null };
}): Promise<{ access: SpeakingPaperView["access"]; title: string } | null> {
  const [format, open] = await Promise.all([readGoalSpeakingFormat(goal), hasSpeakingAccess()]);
  return format ? { access: open ? "open" : "plusRequired", title: format.title } : null;
}

/** The learner's own goal and the speaking paper it prepares for; null for any other goal. */
export async function findExamSpeakingSetup({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<ExamSpeakingSetup | null> {
  const goal = await prisma.goal.findFirst({
    include: { examBlueprint: { select: { name: true } } },
    where: { id: goalId, kind: { in: ["exam", "language"] }, userId },
  });

  const format = goal ? await readGoalSpeakingFormat(goal) : null;
  return goal && format ? { format, goal } : null;
}

/** Exam speaking tasks, like every mock exam, come with Plus; free learners see them locked. */
export async function hasSpeakingAccess(): Promise<boolean> {
  const allowance = await getAllowance();
  return allowance?.examPrep.includesMockExams ?? false;
}

/**
 * The plan's call time that can't fit a task's shortest official length, today's or this month's:
 * a task cut short would be graded on less than the exam asks, so it waits instead, and no card is
 * written for it. Null when it fits.
 */
export async function findShortCallTime(seconds: number): Promise<AllowanceLimit | null> {
  const allowance = await getAllowance();

  if (!allowance) {
    return null;
  }

  const { callTime, tier } = allowance;

  const periods = [
    { left: callTime.limitSeconds, period: "day", used: callTime.usedSeconds },
    { left: callTime.monthLimitSeconds, period: "month", used: callTime.usedSecondsThisMonth },
  ] as const;

  const short = periods.find(({ left, used }) => left !== null && left - used < seconds);

  if (!short || short.left === null) {
    return null;
  }

  return { limit: short.left, period: short.period, resource: "callSeconds", tier };
}
