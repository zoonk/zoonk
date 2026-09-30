import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

/** The last part of a conversation holds what's new; older turns were read after earlier messages. */
const MAX_CHAT_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 1000;

export type MemoryChatMessage = { role: "learner" | "tutor"; text: string };

/**
 * A conversation as the extraction model reads it. Only the learner's lines are evidence; the
 * tutor's lines stay for context, labeled as such.
 */
export function formatChatInput(messages: readonly MemoryChatMessage[]): string {
  return messages
    .slice(-MAX_CHAT_MESSAGES)
    .map(({ role, text }) => {
      const speaker = role === "learner" ? "Learner" : "Tutor";
      return `${speaker}: ${text.trim().slice(0, MAX_MESSAGE_LENGTH)}`;
    })
    .join("\n");
}

function formatDetails(details: unknown): string[] {
  if (!isJsonObject(details)) {
    return [];
  }

  return Object.entries(details).flatMap(([key, value]) =>
    typeof value === "string" || typeof value === "number" ? [`${key}: ${value}`] : [],
  );
}

/**
 * What the learner told onboarding about one goal: their own words first, then the answers the
 * goal kept. Null when the goal isn't the learner's.
 */
export async function loadOnboardingInput({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<{ input: string; language: string } | null> {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });

  if (!goal) {
    return null;
  }

  const lines = [
    `In their words: ${goal.prompt}`,
    `Goal: ${goal.title}`,
    goal.targetDate && `Target date: ${goal.targetDate.toISOString().slice(0, 10)}`,
    `Daily study time: ${goal.dailyMinutes} minutes`,
    goal.studyTime && `Preferred study time: ${goal.studyTime}`,
    ...formatDetails(goal.details),
  ].filter(Boolean);

  return { input: lines.join("\n"), language: goal.language };
}
