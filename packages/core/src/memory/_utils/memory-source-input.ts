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

/**
 * The answers a goal keeps about who the learner is and what they aim for. The rest are this
 * goal's settings (when, how long and on which days they study it: 30 minutes for an exam, 10
 * for a language) or the app's own bookkeeping, which memory would carry into every other goal.
 */
const LEARNER_DETAILS: ReadonlySet<string> = new Set([
  "course",
  "exam",
  "examName",
  "field",
  "institution",
  "level",
  "levelNote",
  "purpose",
  "reason",
  "role",
  "subject",
  "targetCourse",
  "targetLevel",
  "targetNote",
  "targetPosition",
  "targetScore",
  "tasks",
  "university",
]);

/** The follow-up questions onboarding asked about the goal, with the learner's own answers. */
function formatFollowUps(followUps: unknown): string[] {
  if (!Array.isArray(followUps)) {
    return [];
  }

  return followUps.flatMap((item: unknown) =>
    isJsonObject(item) && typeof item.question === "string" && typeof item.answer === "string"
      ? [`${item.question} ${item.answer}`]
      : [],
  );
}

function formatDetails(details: unknown): string[] {
  if (!isJsonObject(details)) {
    return [];
  }

  const answers = Object.entries(details).flatMap(([key, value]) =>
    LEARNER_DETAILS.has(key) && (typeof value === "string" || typeof value === "number")
      ? [`${key}: ${value}`]
      : [],
  );

  return [...answers, ...formatFollowUps(details.followUps)];
}

/**
 * What the learner told onboarding about one goal: their own words first, then the answers the
 * goal kept about them, never its time or schedule. Null when the goal isn't the learner's.
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
    ...formatDetails(goal.details),
  ].filter(Boolean);

  return { input: lines.join("\n"), language: goal.language };
}
