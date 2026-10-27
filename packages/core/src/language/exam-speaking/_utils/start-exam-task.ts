import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type AllowanceLimit } from "../../../entitlements/contract";
import { saveDayBeforeActivity } from "../../../sessions/ensure-study-session";
import { readLiveCallAdmission } from "../../conversations/_utils/live-call-policy";
import { type SpeakingFormat, type SpeakingTaskFormat } from "../speaking-format";
import { getSpeakingTask } from "../speaking-formats";
import {
  type ExamSpeakingSetup,
  findExamSpeakingSetup,
  findShortCallTime,
  hasSpeakingAccess,
} from "./exam-speaking-setup";
import { writeExamTask } from "./write-exam-task";

const SECONDS_PER_MINUTE = 60;

export type StartExamTaskResult =
  | { conversationId: string; status: "ready" }
  | { limit: AllowanceLimit; status: "limitReached" }
  | { status: "callsPaused" | "notFound" | "notLanguage" | "plusRequired" };

function isCardFor({
  format,
  scenario,
  task,
}: {
  format: SpeakingFormat;
  scenario: unknown;
  task: SpeakingTaskFormat;
}): boolean {
  const examTask = isJsonObject(scenario) ? scenario.examTask : null;

  return (
    isJsonObject(examTask) &&
    examTask.exam === format.exam &&
    examTask.level === format.level &&
    examTask.task === task.key
  );
}

/**
 * A card of the same task the learner opened and never called: starting the task again takes it
 * instead of paying for another. A section's tasks stay with their section.
 */
async function findWaitingExamTask({
  format,
  goal,
  task,
}: ExamSpeakingSetup & { task: SpeakingTaskFormat }): Promise<{ id: string } | null> {
  const waiting = await prisma.languageConversation.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, scenario: true },
    where: {
      goalId: goal.id,
      kind: "examSpeaking",
      sectionId: null,
      startedAt: null,
      status: "ready",
      userId: goal.userId,
    },
  });

  return waiting.find((row) => isCardFor({ format, scenario: row.scenario, task })) ?? null;
}

/**
 * One task of the goal's speaking paper, practiced on its own: a waiting card of it, else a new one
 * written now. A task that continues an earlier one gets a topic of its own when practiced alone.
 * Plus only, like every mock exam: the free plan writes nothing. A task whose shortest official
 * length doesn't fit the call time left today or this month waits (`limitReached`), unwritten.
 */
export async function startExamTask({
  goalId,
  task,
  userId,
}: {
  goalId: string;
  task: string;
  userId: string;
}): Promise<StartExamTaskResult> {
  const setup = await findExamSpeakingSetup({ goalId, userId });

  if (!setup) {
    return { status: "notLanguage" };
  }

  // A finished task counts for the day's call mission too, as any finished call does.
  await saveDayBeforeActivity({ goalId, language: setup.goal.targetLanguage, userId });

  const taskFormat = getSpeakingTask({ format: setup.format, task });

  if (!taskFormat) {
    return { status: "notFound" };
  }

  if (!(await hasSpeakingAccess())) {
    return { status: "plusRequired" };
  }

  if ((await readLiveCallAdmission({ transaction: prisma, userId })) === null) {
    return { status: "callsPaused" };
  }

  const short = await findShortCallTime(taskFormat.minutes.min * SECONDS_PER_MINUTE);

  if (short) {
    return { limit: short, status: "limitReached" };
  }

  const waiting = await findWaitingExamTask({ ...setup, task: taskFormat });

  if (waiting) {
    return { conversationId: waiting.id, status: "ready" };
  }

  const written = await writeExamTask({ ...setup, task: taskFormat });
  return { conversationId: written.conversationId, status: "ready" };
}
