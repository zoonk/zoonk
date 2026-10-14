import "server-only";
import { type Sql, type StudySessionBlock, type TransactionClient, prisma, sql } from "@zoonk/db";
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

/** The picks done outside the day's blocks, which count what the learner did today. */
const DAY_PROGRESS_KINDS: readonly MissionPick["kind"][] = [
  "askBuddy",
  "call",
  "fixMistake",
  "pattern",
  "pronunciation",
];

type DayProgress = {
  fixed: number;
  patterns: Set<string>;
  pronunciation: number;
  calls: number;
  questions: number;
};

type DayProgressRow = {
  calls: number;
  fixed: number;
  patterns: string[];
  pronunciation: number;
  questions: number;
  usage: number;
};

/**
 * What the day's picks count, in one statement: only the counts some pick needs are read, the rest
 * stay zero.
 */
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
  const kinds = new Set(picks.map((pick) => pick.kind));
  const userId = session.userId;

  if (!DAY_PROGRESS_KINDS.some((kind) => kinds.has(kind))) {
    return { calls: 0, fixed: 0, patterns: new Set(), pronunciation: 0, questions: 0 };
  }

  const counted = (kind: MissionPick["kind"], query: Sql) => (kinds.has(kind) ? query : sql`0`);

  const [row] = await client.$queryRaw<DayProgressRow[]>`
    SELECT
      ${counted(
        "fixMistake",
        sql`(SELECT count(*) FROM mistakes WHERE user_id = ${userId}::uuid AND status = 'fixed'
          AND fixed_at >= ${from} AND fixed_at < ${to})`,
      )}::int AS fixed,
      ${
        kinds.has("pattern")
          ? sql`ARRAY(SELECT id::text FROM mistake_patterns WHERE user_id = ${userId}::uuid
              AND practiced_at >= ${from} AND practiced_at < ${to})`
          : sql`'{}'::text[]`
      } AS patterns,
      ${counted(
        "pronunciation",
        sql`(SELECT count(*) FROM learning_events WHERE user_id = ${userId}::uuid
          AND lesson_kind = 'pronunciationReview' AND ended_at >= ${from} AND ended_at < ${to})`,
      )}::int AS pronunciation,
      ${counted(
        "call",
        sql`(SELECT count(*) FROM language_conversations WHERE user_id = ${userId}::uuid
          AND status = 'completed' AND spoken_seconds > 0 AND ended_at >= ${from} AND ended_at < ${to})`,
      )}::int AS calls,
      ${counted(
        "askBuddy",
        sql`(SELECT count(*) FROM lesson_questions q JOIN lesson_question_threads t ON t.id = q.thread_id
          WHERE t.user_id = ${userId}::uuid AND q.created_at >= ${from} AND q.created_at < ${to})`,
      )}::int AS questions,
      ${counted(
        "askBuddy",
        sql`(SELECT count(*) FROM usage_records WHERE user_id = ${userId}::uuid
          AND kind = 'tutor_message' AND created_at >= ${from} AND created_at < ${to})`,
      )}::int AS usage`;

  return {
    calls: row?.calls ?? 0,
    fixed: row?.fixed ?? 0,
    patterns: new Set(row?.patterns),
    pronunciation: row?.pronunciation ?? 0,
    questions: Math.max(row?.questions ?? 0, row?.usage ?? 0),
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
