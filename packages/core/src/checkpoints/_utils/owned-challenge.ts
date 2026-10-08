import "server-only";
import {
  type ExamBlueprint,
  type Goal,
  type Plan,
  type PlanItem,
  type StudySession,
  type StudySessionBlock,
  prisma,
} from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getSession } from "../../users/get-session";

const CHALLENGE_KINDS: PlanItem["kind"][] = ["boss", "checkpoint", "mock"];

export type OwnedChallenge = {
  goal: Goal & { examBlueprint: ExamBlueprint | null };
  item: PlanItem;
  /** The plan's items in order, to tell whether a phase's checkpoint is reached. */
  items: PlanItem[];
  plan: Plan;
  timeZone: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
  userId: string;
};

export type OwnedChallengeResult =
  | { challenge: OwnedChallenge; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * One of the signed-in learner's challenges, by its plan item: a phase checkpoint or the week's
 * challenge. Another learner's item, or one that isn't a challenge, is "not found".
 */
export async function findOwnedChallenge({
  planItemId,
  timeZone: requestTimeZone,
}: {
  planItemId: string;
  timeZone?: string;
}): Promise<OwnedChallengeResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const item = isUuid(planItemId)
    ? await prisma.planItem.findFirst({
        include: {
          plan: {
            include: {
              goal: { include: { examBlueprint: true } },
              items: { orderBy: { position: "asc" } },
            },
          },
        },
        where: { id: planItemId, kind: { in: CHALLENGE_KINDS }, plan: { goal: { userId } } },
      })
    : null;

  if (!item) {
    return { status: "notFound" };
  }

  const { plan, ...planItem } = item;
  const { goal, items, ...planRow } = plan;
  const timeZone = getAnswerTimeZone({ goal, timeZone: requestTimeZone });

  return {
    challenge: {
      goal,
      item: planItem,
      items,
      plan: planRow,
      timeZone,
      today: getDateInTimeZone({ date: new Date(), timeZone }),
      userId,
    },
    status: "ready",
  };
}

export type ChallengeBlock = StudySessionBlock & { session: StudySession };

/** The latest session block that plays a challenge: today's, or the last day it was played. */
export function findChallengeBlock({
  challenge,
}: {
  challenge: Pick<OwnedChallenge, "goal" | "item" | "userId">;
}): Promise<ChallengeBlock | null> {
  return prisma.studySessionBlock.findFirst({
    include: { session: true },
    orderBy: { createdAt: "desc" },
    where: {
      kind: "checkpoint",
      payload: { equals: challenge.item.id, path: ["planItemId"] },
      session: { goalId: challenge.goal.id, userId: challenge.userId },
    },
  });
}

/** The block when it's of the learner's session on their today; null otherwise. */
export function getTodayBlock({
  block,
  today,
}: {
  block: ChallengeBlock | null;
  today: Date;
}): ChallengeBlock | null {
  return block?.session.localDate.getTime() === today.getTime() ? block : null;
}
