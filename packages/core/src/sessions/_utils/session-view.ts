import { type StudySessionBlock } from "@zoonk/db";
import { type z } from "zod";
import { type StudyWeek } from "../../progress/_utils/load-study-week";
import { type studyBlockSchema } from "../block-view-contract";
import { getNextBlock, isDayBlock } from "../day-blocks";
import { type DayState, withDayState } from "../day-state";
import { type ExtraTime } from "../extra-time";
import { type Mission } from "../missions";
import { type SessionMinutes } from "../session-minutes";
import { toDayBlockView } from "./day-block-view";
import { inDayOrder } from "./day-order";
import { type DayViewFieldsInput, toDayViewFields } from "./day-view-fields";
import { type ExamPrepAccess } from "./exam-access";
import { type StudySessionRow } from "./study-session-access";

export type StudyBlockView = z.infer<typeof studyBlockSchema>;

export function toStudyBlockView(
  input: Omit<Parameters<typeof toDayBlockView>[0], "block"> & { block: StudySessionBlock },
): StudyBlockView {
  return { ...toDayBlockView(input), id: input.block.id };
}

export function toStudyBlockViews({
  answers,
  blocks,
  blockedTestOutChapters,
  oftenTestedSkillIds,
  preparing,
  subjects,
  writingTasks,
}: {
  answers: DayViewFieldsInput["answers"];
  blocks: readonly StudySessionBlock[];
  blockedTestOutChapters?: ReadonlySet<string>;
  oftenTestedSkillIds?: ReadonlySet<string>;
  preparing: ReadonlySet<number>;
  subjects?: ReadonlyMap<number, string>;
  writingTasks?: Parameters<typeof toDayBlockView>[0]["writingTasks"];
}): StudyBlockView[] {
  const answeredAttemptIds = new Set(answers.map((answer) => answer.id));
  const answeredItemIds = new Set(answers.flatMap((answer) => answer.itemId ?? []));

  const savedWritingTasks = new Map(
    answers.flatMap(({ itemId, writingTask }) =>
      itemId && writingTask !== undefined ? [[itemId, writingTask] as const] : [],
    ),
  );

  return inDayOrder(
    blocks.map((block) =>
      toStudyBlockView({
        answeredAttemptIds,
        answeredItemIds,
        block,
        blockedTestOutChapters,
        blocks,
        oftenTestedSkillIds,
        preparing: preparing.has(block.position),
        savedWritingTasks,
        subject: subjects?.get(block.position),
        writingTasks,
      }),
    ),
  );
}

export type EmptyDay = "lessonsComing" | "lessonsToPrepare" | "nothingNew";

/** offered permits adding leftover lessons when they take about one extra study day. */
export type CatchUpView = {
  blockIds: string[];
  positions: number[];
  later: { lessons: number; minutes: number; offered: boolean };
  lessonsLeft: number;
};

export type StudySessionView = {
  blocks: StudyBlockView[];
  /** Brain Power earned so far in this session, full meal included. */
  brainPower: number;
  /** Null on pace and in completed-session summaries. */
  catchUp: CatchUpView | null;
  /** Includes an unfinished session from before midnight; earlier days cannot open more work. */
  current: boolean;
  dayEndsAt: number;
  /** Null with blocks or no study time; lessonsComing fills automatically, lessonsToPrepare waits for the learner to ask for them, and nothingNew offers alternatives. */
  emptyDay: EmptyDay | null;
  examAccess: ExamPrepAccess;
  /** Do not promise work tomorrow when the goal's exam is tomorrow. */
  examTomorrow: boolean;
  extraTime: ExtraTime;
  freshStart: StudySessionRow["freshStart"];
  /** Held outlines append at the next Open/Continue; empty days use emptyDay instead. */
  lessonsComing: boolean;
  lessonPlaceholder?: { minutes: number; title: string } | null;
  /** A day holding time for lessons nobody is outlining: the learner asks for them, as on an empty day's lessonsToPrepare. */
  lessonsToPrepare: boolean;
  fullMeal: { bonus: number; earned: boolean; ready: boolean };
  goalId: string | null;
  /** Right answers in a row on new or due material. */
  hyperdrive: { level: number; streak: number };
  id: string;
  localDate: Date;
  minutes: SessionMinutes;
  missions: Mission[];
  nextBlockId: string | null;
  nextPosition: number | null;
  pauseSuggested: boolean;
  sessionBar: { completed: number; total: number };
  /** Where the day stands, which decides what Today offers. */
  state: DayState;
  status: StudySessionRow["status"];
  week: SessionWeek;
};

export type SessionWeek = Pick<StudyWeek, "days" | "nextStudyDate">;

/** For a session whose goal was deleted, and for summaries, which show no week. */
export const EMPTY_WEEK: SessionWeek = { days: [], nextStudyDate: null };

export function getSessionBar(blocks: readonly Pick<StudySessionBlock, "status" | "payload">[]) {
  return {
    completed: blocks.filter((block) => isDayBlock(block) && block.status === "completed").length,
    total: blocks.filter((block) => isDayBlock(block) && block.status !== "skipped").length,
  };
}

/** Adds only persisted session and block ids to the shared display projection. */
export function toStudySessionView({
  blockViews: blocks,
  ...input
}: Omit<DayViewFieldsInput, "missions" | "preparing" | "session" | "sessionBar"> & {
  blockViews: StudyBlockView[];
  missions: Mission[];
  session: StudySessionRow;
}): StudySessionView {
  const { session } = input;
  const preparing = new Set(blocks.flatMap((block) => (block.preparing ? [block.position] : [])));
  const next = getNextBlock(blocks);

  return withDayState(
    {
      ...toDayViewFields({ ...input, preparing, sessionBar: getSessionBar(session.blocks) }),
      blocks,
      id: session.id,
      missions: input.missions,
      nextBlockId: next?.id ?? null,
      nextPosition: next?.position ?? null,
      status: session.status,
    },
    session.endedAt,
  );
}
