import { type StudySessionBlock } from "@zoonk/db";
import { type z } from "zod";
import { type StudyWeek } from "../../progress/_utils/load-study-week";
import { type studyBlockSchema } from "../block-view-contract";
import { type DayState, withDayState } from "../day-state";
import { type ExtraTime } from "../extra-time";
import { type Mission } from "../missions";
import { toDayBlockView } from "./day-block-view";
import { type DayViewFieldsInput, toDayViewFields } from "./day-view-fields";
import { type ExamPrepAccess } from "./exam-access";
import { type PlusLesson } from "./plus-only-lessons";
import { type StudySessionRow } from "./study-session-access";

export type StudyBlockView = z.infer<typeof studyBlockSchema>;

const NO_SKILLS: ReadonlySet<string> = new Set();
const NO_SUBJECTS: ReadonlyMap<number, string> = new Map();

export function toStudyBlockView(
  input: Omit<Parameters<typeof toDayBlockView>[0], "block"> & { block: StudySessionBlock },
): StudyBlockView {
  return { ...toDayBlockView(input), id: input.block.id };
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
  /** A day holding time for lessons nobody is outlining: the learner asks for them, as on an empty day's lessonsToPrepare. */
  lessonsToPrepare: boolean;
  fullMeal: { bonus: number; earned: boolean; ready: boolean };
  goalId: string | null;
  /** Right answers in a row on new or due material. */
  hyperdrive: { level: number; streak: number };
  id: string;
  localDate: Date;
  /** done uses planned durations of completed blocks rather than measured elapsed time. */
  minutes: { dailyGoal: number; done: number; planned: number };
  missions: Mission[];
  nextBlockId: string | null;
  nextPosition: number | null;
  pauseSuggested: boolean;
  /** Locked plan lessons outside the queue, shown only after a free exam plan's first week. */
  plusLessons: PlusLesson[];
  sessionBar: { completed: number; total: number };
  /** Where the day stands, which decides what Today offers. */
  state: DayState;
  status: StudySessionRow["status"];
  week: StudyWeek;
};

export function getSessionBar(blocks: readonly Pick<StudySessionBlock, "status">[]) {
  return {
    completed: blocks.filter((block) => block.status === "completed").length,
    total: blocks.filter((block) => block.status !== "skipped").length,
  };
}

export function getNextBlockId(blocks: readonly StudySessionBlock[]): string | null {
  const next =
    blocks.find((block) => block.status === "active") ??
    blocks.find((block) => block.status === "pending");

  return next?.id ?? null;
}

/** Adds only persisted session and block ids to the shared display projection. */
export function toStudySessionView(
  input: Omit<DayViewFieldsInput, "session" | "missions" | "sessionBar"> & {
    blockViews?: StudyBlockView[];
    blockSubjects?: ReadonlyMap<number, string>;
    blockedTestOutChapters?: ReadonlySet<string>;
    missions: Mission[];
    oftenTestedSkillIds?: ReadonlySet<string>;
    session: StudySessionRow;
  },
): StudySessionView {
  const {
    blockSubjects = NO_SUBJECTS,
    blockedTestOutChapters = NO_SKILLS,
    oftenTestedSkillIds,
    session,
  } = input;

  const answeredItemIds = new Set(input.answers.flatMap((answer) => answer.itemId ?? []));

  return withDayState({
    ...toDayViewFields({ ...input, sessionBar: getSessionBar(session.blocks) }),
    blocks:
      input.blockViews ??
      session.blocks.map((block) =>
        toStudyBlockView({
          answeredItemIds,
          block,
          blockedTestOutChapters,
          blocks: session.blocks,
          oftenTestedSkillIds,
          subject: blockSubjects.get(block.position) ?? null,
        }),
      ),
    id: session.id,
    missions: input.missions,
    nextBlockId: getNextBlockId(session.blocks),
    status: session.status,
  });
}
