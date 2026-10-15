import "server-only";
import { type Sql, type TransactionClient, prisma, sql } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { type DayBlockInput, toDayBlockView } from "../_utils/day-block-view";
import { getStoredBlockWait } from "../block-wait";
import { toDayBlockRef } from "../day-block";
import { type DayMission } from "../day-view";
import { type Mission } from "../missions";
import { type MissionPick } from "./catalog";
import { getMissionBlocks } from "./mission-blocks";
import { getBlockTitle, getMissionMinutes } from "./mission-time";

export type MissionDay = { blocks: readonly DayBlockInput[]; localDate: Date; userId: string };

/** The picks done outside the day's blocks, which count what the learner did today. */
const DAY_PROGRESS_KINDS: readonly MissionPick["kind"][] = [
  "askBuddy",
  "call",
  "fixMistake",
  "pattern",
  "pronunciation",
];

type MissionView = Omit<Mission, "opens"> & { opens?: Mission["opens"] | DayMission["opens"] };

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
  session: MissionDay;
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
  blocks: readonly DayBlockInput[];
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

function getMissionOpens({
  block,
  pick,
  session,
}: {
  block: DayBlockInput | undefined;
  pick: MissionPick;
  session: MissionDay;
}): MissionView["opens"] {
  if (!block) {
    return pick.opens;
  }

  if (block.id) {
    return { blockId: block.id, kind: "block" };
  }

  return {
    kind: "block",
    ref: toDayBlockRef(
      toDayBlockView({ answeredItemIds: new Set(), block, blocks: session.blocks }),
    ),
  };
}

function toMission({
  pick,
  session,
  progress,
}: {
  pick: MissionPick;
  session: MissionDay;
  progress: DayProgress;
}): MissionView | null {
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
  const opens = getMissionOpens({ block, pick, session });
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

/** Saved and preview missions read the same day progress and anchors. */
export async function loadMissionDayViews({
  client = prisma,
  picks,
  session,
  through,
  timeZone,
}: {
  client?: TransactionClient;
  picks: readonly MissionPick[];
  session: MissionDay;
  through?: Date;
  timeZone: string;
}): Promise<MissionView[]> {
  const progress = await loadDayProgress({ client, picks, session, through, timeZone });

  return picks
    .map((pick) => toMission({ pick, progress, session }))
    .filter((mission) => mission !== null);
}

/** Persisted blocks must always open their actual stored IDs. */
export function asSavedMission(mission: MissionView): Mission {
  const { opens, ...fields } = mission;

  if (opens?.kind === "block") {
    if (!("blockId" in opens)) {
      throw new Error("Expected a saved block target.");
    }

    return { ...fields, opens };
  }

  return { ...fields, ...(opens && { opens }) };
}

/** Preview blocks must never invent a persisted target. */
export function asDayMission(mission: MissionView): DayMission {
  const { opens, ...fields } = mission;

  if (opens?.kind === "block") {
    if (!("ref" in opens)) {
      throw new Error("Expected a preview block target.");
    }

    return { ...fields, opens };
  }

  return { ...fields, ...(opens && { opens }) };
}
