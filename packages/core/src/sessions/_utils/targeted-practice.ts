import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readBlockPayload } from "../block-payload";
import { ensureStudySession } from "../ensure-study-session";
import { type ExtraTimeReason, getExtraTime, hasExtraPracticeLeft } from "../extra-time";
import { getDailyTimeLimitStatus } from "../get-daily-time-limit";
import {
  appendExtraBlocks,
  buildExtraLessons,
  buildExtraPractice,
  withSessionAppendLock,
} from "./extra-blocks";
import { type StudyBlockView, toStudyBlockView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

export type TargetedPracticeResult =
  | { block: StudyBlockView; sessionId: string; status: "ready" }
  | { status: "nothingToPractice" }
  | { reason: ExtraTimeReason; status: "unavailable" };

/** Repeated taps reuse an unfinished block; planItemIds supply the next lesson only when no practice remains. */
export type PracticeTarget = {
  planItemIds: string[] | null;
  skillIds: string[];
  title: string | null;
} & ({ areaId: string; refresh: false } | { areaId: null; refresh: true });

function isUnfinished(block: StudySessionRow["blocks"][number]) {
  return block.status === "pending" || block.status === "active";
}

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

function findUnfinishedBlock({
  session,
  target,
}: {
  session: StudySessionRow;
  target: PracticeTarget;
}) {
  return session.blocks.find((block) => {
    const payload = readBlockPayload(block);

    return (
      isUnfinished(block) &&
      payload.extra &&
      payload.areaId === target.areaId &&
      payload.refresh === target.refresh
    );
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
    findUnfinishedBlock({ session, target }) ??
    (target.refresh ? findCoveringBlock({ session, skillIds: target.skillIds }) : undefined);

  if (reused) {
    return {
      block: toStudyBlockView({ answeredItemIds: new Set(), block: reused }),
      sessionId: session.id,
      status: "ready",
    };
  }

  const blocks = session.blocks.map((block) => ({
    extra: readBlockPayload(block).extra,
    kind: block.kind,
    status: block.status,
  }));

  const extraTime = getExtraTime({ anytime: true, blocks, remainingLimitMinutes });

  if (!extraTime.available) {
    return { reason: extraTime.reason ?? "dailyCap", status: "unavailable" };
  }

  if (!hasExtraPracticeLeft(blocks)) {
    return { reason: "dailyCap", status: "unavailable" };
  }

  const { areaId, planItemIds, refresh, skillIds, title } = target;

  const practice = await buildExtraPractice({
    areaId,
    minutes: extraTime.minutes,
    refresh,
    session,
    skillIds,
    title,
    userId,
  });

  const lessons =
    practice || !planItemIds ? [] : await buildExtraLessons({ areaId, planItemIds, session });

  const planned = practice ?? lessons[0];

  if (!planned) {
    return { status: "nothingToPractice" };
  }

  return {
    block: await appendExtraBlocks({ planned: [planned], session, transaction }),
    sessionId: session.id,
    status: "ready",
  };
}

/** May precede session completion but obeys extra-time and reward caps; concurrent taps reuse the same target block. */
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
