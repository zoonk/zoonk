import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

const MAX_CHAT_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 1000;

export type MemoryChatMessage = { role: "learner" | "tutor"; text: string };

export function formatChatInput(messages: readonly MemoryChatMessage[]): string {
  return messages
    .slice(-MAX_CHAT_MESSAGES)
    .map(({ role, text }) => {
      const speaker = role === "learner" ? "Learner" : "Tutor";
      return `${speaker}: ${text.trim().slice(0, MAX_MESSAGE_LENGTH)}`;
    })
    .join("\n");
}

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
