import "server-only";
import { prisma } from "@zoonk/db";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getPracticeTimeZone } from "../mistake-availability";
import { findPracticeMock, mockMistakeWhere } from "./mock-practice";
import { findPracticeBlock } from "./practice-block";

async function getMockAnswerScope({
  mistakeId,
  mockId,
  timeZone,
  userId,
}: {
  mistakeId: string;
  mockId: string;
  timeZone?: string;
  userId: string;
}) {
  const mock = await findPracticeMock({ mockId, userId });

  if (!mock) {
    return null;
  }

  const member = await prisma.mistake.count({
    where: { ...(await mockMistakeWhere({ mockId, userId })), id: mistakeId },
  });

  return member
    ? {
        goalId: mock.goal?.id,
        timeZone: await getPracticeTimeZone({ goal: mock.goal, timeZone, userId }),
      }
    : null;
}

export async function getPracticeAnswerScope({
  blockId,
  goalId,
  mistakeId,
  mockId,
  timeZone,
  userId,
}: {
  blockId?: string;
  goalId?: string;
  mistakeId: string;
  mockId?: string;
  timeZone?: string;
  userId: string;
}) {
  if (mockId) {
    return blockId ? null : getMockAnswerScope({ mistakeId, mockId, timeZone, userId });
  }

  const block = blockId ? await findPracticeBlock({ blockId, userId }) : null;

  if (
    blockId &&
    (!block ||
      !block.mistakeIds.includes(mistakeId) ||
      (goalId !== undefined && block.session.goalId !== goalId))
  ) {
    return null;
  }

  const owned = !block && goalId ? await findOwnedGoal(goalId) : null;
  const goal = block?.session.goal ?? (owned?.status === "ready" ? owned.goal : null);

  return {
    goalId: block ? (goal?.id ?? undefined) : goalId,
    timeZone: await getPracticeTimeZone({ goal, timeZone, userId }),
  };
}
