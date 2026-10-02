import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getDailyTimeLimitStatus } from "../../minors/get-daily-time-limit";
import { readBlockPayload } from "../block-payload";
import { ensureStudySession } from "../ensure-study-session";
import { type ExtraTimeReason, getExtraTime } from "../extra-time";
import {
  appendExtraBlock,
  buildExtraLesson,
  buildExtraPractice,
  withSessionAppendLock,
} from "./extra-blocks";
import { type StudyBlockView, toStudyBlockView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

export type TargetedPracticeResult =
  | { block: StudyBlockView; sessionId: string; status: "ready" }
  | { status: "nothingToPractice" }
  | { reason: ExtraTimeReason; status: "unavailable" };

/**
 * What a bonus block practices. `areaId` names it in the block, so a second tap finds the same
 * unfinished block. `reuseSessionBlock` first opens a block of today's session that already asks
 * about these skills (today's reviews of them), before adding anything. When nothing is left to
 * practice, `planItemIds` are where its next lesson comes from (none: practice only).
 */
export type PracticeTarget = {
  areaId: string;
  planItemIds: string[] | null;
  reuseSessionBlock?: boolean;
  skillIds: string[];
  title: string | null;
};

function isUnfinished(block: StudySessionRow["blocks"][number]) {
  return block.status === "pending" || block.status === "active";
}

/** An unfinished block of today's session that asks about any of these skills. */
function findCoveringBlock({
  session,
  skillIds,
}: {
  session: StudySessionRow;
  skillIds: string[];
}) {
  const wanted = new Set(skillIds);

  return session.blocks.find((block) => {
    const { capsules, skillIds: practiced } = readBlockPayload(block);
    const blockSkills = [...practiced, ...capsules.flatMap((capsule) => capsule.skillIds)];

    return isUnfinished(block) && blockSkills.some((skillId) => wanted.has(skillId));
  });
}

/** A second tap opens the target's unfinished block instead of adding another. */
function findUnfinishedBlock({ areaId, session }: { areaId: string; session: StudySessionRow }) {
  return session.blocks.find((block) => {
    const payload = readBlockPayload(block);
    return isUnfinished(block) && payload.extra && payload.areaId === areaId;
  });
}

async function addToLockedSession({
  remainingLimitMinutes,
  session,
  target,
  transaction,
  userId,
}: {
  remainingLimitMinutes: number | null;
  session: StudySessionRow;
  target: PracticeTarget;
  transaction: TransactionClient;
  userId: string;
}): Promise<TargetedPracticeResult> {
  const reused =
    findUnfinishedBlock({ areaId: target.areaId, session }) ??
    (target.reuseSessionBlock
      ? findCoveringBlock({ session, skillIds: target.skillIds })
      : undefined);

  if (reused) {
    return {
      block: toStudyBlockView({ answeredItemIds: new Set(), block: reused }),
      sessionId: session.id,
      status: "ready",
    };
  }

  const extraTime = getExtraTime({
    anytime: true,
    blocks: session.blocks.map((block) => ({
      extra: readBlockPayload(block).extra,
      status: block.status,
    })),
    remainingLimitMinutes,
  });

  if (!extraTime.available) {
    return { reason: extraTime.reason ?? "dailyCap", status: "unavailable" };
  }

  const { areaId, planItemIds, skillIds, title } = target;

  // Practice first; with nothing studied (or asked already today), the target's next lesson.
  const planned =
    (await buildExtraPractice({
      areaId,
      minutes: extraTime.minutes,
      session,
      skillIds,
      title,
      userId,
    })) ?? (planItemIds ? await buildExtraLesson({ areaId, planItemIds, session, userId }) : null);

  if (!planned) {
    return { status: "nothingToPractice" };
  }

  return {
    block: await appendExtraBlock({ planned, session, transaction }),
    sessionId: session.id,
    status: "ready",
  };
}

/**
 * Adds a bonus block of practice on some of a goal's skills to today's session ("Practice now"
 * on an area, "Refresh now" on fading skills). It can start before the day's session is done,
 * but it counts as extra time like "10 more minutes": at most two bonus blocks a day, never past
 * a guardian's limit, and its Brain Power is capped. Two taps at once see each other's block.
 */
export async function addTargetedPracticeBlock({
  goal,
  target,
  timeZone: requestTimeZone,
  userId,
}: {
  goal: Goal;
  target: PracticeTarget;
  timeZone?: string;
  userId: string;
}): Promise<TargetedPracticeResult> {
  const timeZone = getAnswerTimeZone({ goal, timeZone: requestTimeZone });

  const [session, limit] = await Promise.all([
    ensureStudySession({
      goal,
      localDate: getDateInTimeZone({ date: new Date(), timeZone }),
      timeZone,
      userId,
    }),
    getDailyTimeLimitStatus(),
  ]);

  return withSessionAppendLock({
    run: ({ session: locked, transaction }) =>
      addToLockedSession({
        remainingLimitMinutes: limit?.remainingMinutes ?? null,
        session: locked,
        target,
        transaction,
        userId,
      }),
    session,
  });
}
