import "server-only";
import { SPEAKING_EXAM_LANGUAGES } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { type Goal, prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { type AllowanceLimit } from "../../../entitlements/contract";
import { getAllowance } from "../../../entitlements/get-allowance";
import { getSpeakingLevel, toSpeakingLevel } from "../../conversations/_utils/conversation-goal";
import { readLiveCallAdmission } from "../../conversations/_utils/live-call-policy";
import { type SpeakingPaperView } from "../speaking-contract";
import { type SpeakingFormat } from "../speaking-format";
import { getSpeakingFormat } from "../speaking-formats";
import { getSpeakingExamGoal } from "../speaking-goal";
import { toSpeakingPaperView } from "../speaking-views";
import { loadLastTries } from "./speaking-last-tries";

export type ExamSpeakingSetup = { format: SpeakingFormat; goal: Goal };

const EXAM_LANGUAGES = Object.values(SPEAKING_EXAM_LANGUAGES);

function hasExamLanguage(goal: Pick<Goal, "targetLanguage">): goal is { targetLanguage: string } {
  return Boolean(goal.targetLanguage && EXAM_LANGUAGES.includes(goal.targetLanguage));
}

function findGoalSpeakingFormat({
  fallbackLevel,
  goal,
}: {
  fallbackLevel: CefrLevel;
  goal: Goal & { examBlueprint?: { name: string } | null };
}): SpeakingFormat | null {
  const found = getSpeakingExamGoal({
    fallbackLevel,
    goal: { ...goal, blueprintName: goal.examBlueprint?.name },
  });

  return found ? getSpeakingFormat(found) : null;
}

async function readGoalSpeakingFormat(
  goal: Goal & { examBlueprint?: { name: string } | null },
): Promise<SpeakingFormat | null> {
  if (!hasExamLanguage(goal)) {
    return null;
  }

  const fallbackLevel = await getSpeakingLevel({
    goal,
    targetLanguage: goal.targetLanguage,
    userId: goal.userId,
  });

  return findGoalSpeakingFormat({ fallbackLevel, goal });
}

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

  const [lastTries, admission] = await Promise.all([
    loadLastTries({ format, goal }),
    readLiveCallAdmission({ transaction: prisma, userId: goal.userId }),
  ]);

  return toSpeakingPaperView({
    access: admission === null ? "callsPaused" : access,
    format,
    lastTries,
  });
}

export async function loadSpeakingPaperEntry({
  goal,
}: {
  goal: Goal & { examBlueprint?: { name: string } | null };
}): Promise<{ access: SpeakingPaperView["access"]; title: string } | null> {
  const [format, open] = await Promise.all([readGoalSpeakingFormat(goal), hasSpeakingAccess()]);
  return format ? { access: open ? "open" : "plusRequired", title: format.title } : null;
}

export function hasSpeakingPaper({
  blueprintName,
  goal,
  speakingScore,
}: {
  blueprintName: string | null;
  goal: Goal;
  speakingScore: number | null;
}): boolean {
  if (goal.kind !== "language" || !hasExamLanguage(goal)) {
    return false;
  }

  const fallbackLevel = toSpeakingLevel({ goal, score: speakingScore });
  const examBlueprint = blueprintName ? { name: blueprintName } : null;

  return findGoalSpeakingFormat({ fallbackLevel, goal: { ...goal, examBlueprint } }) !== null;
}

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

export async function hasSpeakingAccess(): Promise<boolean> {
  const allowance = await getAllowance();
  return allowance?.examPrep.includesMockExams ?? false;
}

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
