import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { loadMistakeAvailability } from "../../mistakes/mistake-availability";
import { withLessonDisplayMinutes } from "../_utils/lesson-display-minutes";
import { countMistakesFixedToday, getSessionMissions } from "../_utils/session-missions";
import { type StudySessionRow } from "../_utils/study-session-access";
import { getStoredBlockWait } from "../block-wait";
import { type Mission } from "../missions";
import { type MissionPick, readMissionDocument } from "./catalog";
import { getMissionBlocks } from "./mission-blocks";
import { getBlockTitle, getMissionMinutes } from "./mission-time";

type DayProgress = {
  fixed: number;
  patterns: Set<string>;
  pronunciation: number;
  calls: number;
  questions: number;
};

async function loadDayProgress({
  client,
  picks,
  session,
  timeZone,
  through,
}: {
  client: TransactionClient;
  picks: readonly MissionPick[];
  session: StudySessionRow;
  timeZone: string;
  through?: Date;
}): Promise<DayProgress> {
  const from = getStartOfLocalDay({ localDate: session.localDate, timeZone });

  const nextDay = getStartOfLocalDay({
    localDate: new Date(session.localDate.getTime() + MS_PER_DAY),
    timeZone,
  });
  // A running session keeps its day across midnight; its completion still feeds that day's picks.
  const to = through && through >= nextDay ? new Date(through.getTime() + 1) : nextDay;
  const range = { gte: from, lt: to };
  const kinds = new Set(picks.map((pick) => pick.kind));
  const userId = session.userId;

  const [fixed, patterns, pronunciation, calls, questions, usage] = await Promise.all([
    kinds.has("fixMistake")
      ? client.mistake.count({ where: { fixedAt: range, status: "fixed", userId } })
      : 0,
    kinds.has("pattern")
      ? client.mistakePattern.findMany({ where: { practicedAt: range, userId } })
      : [],
    kinds.has("pronunciation")
      ? client.learningEvent.count({
          where: { endedAt: range, lessonKind: "pronunciationReview", userId },
        })
      : 0,
    kinds.has("call")
      ? client.languageConversation.count({
          where: { endedAt: range, spokenSeconds: { gt: 0 }, status: "completed", userId },
        })
      : 0,
    kinds.has("askBuddy")
      ? client.lessonQuestion.count({ where: { createdAt: range, thread: { userId } } })
      : 0,
    kinds.has("askBuddy")
      ? client.usageRecord.count({ where: { createdAt: range, kind: "tutorMessage", userId } })
      : 0,
  ]);

  return {
    calls,
    fixed,
    patterns: new Set(patterns.map((pattern) => pattern.id)),
    pronunciation,
    questions: Math.max(questions, usage),
  };
}

function getDone({
  blocks,
  pick,
  progress,
}: {
  blocks: readonly StudySessionBlock[];
  pick: MissionPick;
  progress: DayProgress;
}): number {
  const completed = blocks.filter((block) => block.status === "completed").length;

  if (pick.kind === "fixMistake") {
    return progress.fixed;
  }

  if (pick.kind === "pattern") {
    return progress.patterns.has(pick.anchor.patternId ?? "") ? 1 : 0;
  }

  if (pick.kind === "pronunciation") {
    return progress.pronunciation;
  }

  if (pick.kind === "call") {
    return progress.calls;
  }

  if (pick.kind === "askBuddy") {
    return progress.questions;
  }

  return completed;
}

function toMission({
  pick,
  session,
  progress,
}: {
  pick: MissionPick;
  session: StudySessionRow;
  progress: DayProgress;
}): Mission | null {
  const blocks = getMissionBlocks({ blocks: session.blocks, pick });
  const done = Math.min(pick.total, Math.max(pick.done ?? 0, getDone({ blocks, pick, progress })));

  const blockAnchor =
    pick.anchor.blockKind ||
    pick.anchor.planItemId ||
    pick.anchor.planItemIds ||
    pick.anchor.lessonIds;
  // Finishing a pick is permanent. An unfinished pick needs every lesson of its original target.
  const missing =
    blocks.length === 0 || (pick.kind === "finishChapter" && blocks.length < pick.total);

  if (done < pick.total && blockAnchor && missing) {
    return null;
  }

  const block = blocks.find((candidate) => candidate.status !== "completed");
  const opens = block ? { blockId: block.id, kind: "block" as const } : pick.opens;
  const waitReason = block ? getStoredBlockWait({ block, blocks: session.blocks }) : null;
  // The block still to do names the mission's next step ("Simple interest"), not the build's first.
  const title = block ? getBlockTitle(block) : null;
  const detail = title ? { ...pick.detail, title } : pick.detail;
  const minutes = getMissionMinutes({ blocks, done, kind: pick.kind, total: pick.total });

  return {
    done,
    kind: pick.kind,
    status: done >= pick.total ? "done" : "todo",
    total: pick.total,
    ...(minutes > 0 && { minutes }),
    ...(opens && { opens }),
    ...(detail && { detail }),
    ...(pick.firstStep && { firstStep: true }),
    ...(waitReason && { waitReason }),
  };
}

/** One reader for Today, the buddy, summaries and settlement. It never replaces a saved pick. */
export async function getDayMissions({
  session: storedSession,
  displayBlocks,
  timeZone,
  client = prisma,
  through,
}: {
  session: StudySessionRow;
  /** Today shares its resolved durations so missions and queue use the same content snapshot. */
  displayBlocks?: StudySessionBlock[];
  timeZone: string;
  client?: TransactionClient;
  through?: Date;
}): Promise<Mission[]> {
  const document = readMissionDocument(storedSession.missions);

  if (!document) {
    if (storedSession.missions !== null) {
      return [];
    }
    // No backfill: pre-deployment sessions retain their original three-kind read contract.
    const [fixedToday, availability, blocks] = await Promise.all([
      countMistakesFixedToday({
        localDate: storedSession.localDate,
        timeZone,
        userId: storedSession.userId,
      }),
      loadMistakeAvailability({
        goalId: storedSession.goalId,
        localDate: storedSession.localDate,
        timeZone,
        userId: storedSession.userId,
      }),
      displayBlocks ?? withLessonDisplayMinutes({ blocks: storedSession.blocks, client }),
    ]);

    return getSessionMissions({ availableMistakes: availability.ready, blocks, fixedToday });
  }

  const [progress, blocks] = await Promise.all([
    loadDayProgress({ client, picks: document.picks, session: storedSession, through, timeZone }),
    displayBlocks ?? withLessonDisplayMinutes({ blocks: storedSession.blocks, client }),
  ]);

  const session = { ...storedSession, blocks };

  return document.picks
    .map((pick) => toMission({ pick, progress, session }))
    .filter((mission) => mission !== null);
}

/** The bonus belongs to the learner's day across all goals. */
export async function hasDayMissionBonus({
  session,
  client = prisma,
  now,
  timeZone,
}: {
  session: Pick<StudySessionRow, "fullMealAt" | "localDate" | "userId">;
  client?: TransactionClient;
  now?: Date;
  timeZone?: string;
}): Promise<boolean> {
  if (session.fullMealAt !== null) {
    return true;
  }

  if (now) {
    const zone = await getLearnerTimeZone({ timeZone, userId: session.userId });
    const day = getDateInTimeZone({ date: now, timeZone: zone });
    const from = getStartOfLocalDay({ localDate: day, timeZone: zone });

    const to = getStartOfLocalDay({
      localDate: new Date(day.getTime() + MS_PER_DAY),
      timeZone: zone,
    });

    const paid = await client.studySession.count({
      where: { fullMealAt: { gte: from, lt: to }, userId: session.userId },
    });

    return paid > 0;
  }

  return (
    (await client.studySession.count({
      where: { fullMealAt: { not: null }, localDate: session.localDate, userId: session.userId },
    })) > 0
  );
}
