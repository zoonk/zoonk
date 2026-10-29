import { type StudySessionBlock } from "@zoonk/db";
import { type StudyWeek } from "../../progress/_utils/load-study-week";
import { type BlockCheckpoint } from "../block-payload";
import { type CapsuleFormat } from "../capsules";
import { type DayBlockScreen } from "../day-block";
import { type ExtraTime } from "../extra-time";
import { type DailyTimeLimitStatus } from "../get-daily-time-limit";
import { type Mission } from "../missions";
import { toDayBlockView } from "./day-block-view";
import { type DayViewFieldsInput, toDayViewFields } from "./day-view-fields";
import { type ExamPrepAccess } from "./exam-access";
import { type PlusLesson } from "./plus-only-lessons";
import { type StudySessionRow } from "./study-session-access";

type CapsuleView = {
  format: CapsuleFormat;
  key: string;
  lessonId: string | null;
  opened: boolean;
  questions: number;
  title: string;
};

export type StudyBlockView = Pick<
  StudySessionBlock,
  "brainPower" | "canDo" | "id" | "kind" | "lessonId" | "position" | "status"
> & {
  answered: number;
  areaId: string | null;
  /** Whether this lesson's chapter test can be offered after today's test and study history. */
  canTestOut: boolean;
  capsules: CapsuleView[];
  chapterId: string | null;
  checkpoint: BlockCheckpoint | null;
  estimatedBrainPower: number;
  estimatedMinutes: number;
  extra: boolean;
  /** Counts as a test in real conditions when the plan omits a mock. */
  fullReview: boolean;
  /** Contains drills only, without mixed practice questions. */
  mistakesOnly: boolean;
  /** Wrong answers cancel right ones; blanks are allowed. Swipe capsules score net separately. */
  netScored: boolean;
  /** An exam's topic the board asks a lot, from past papers: tiles tag it "Often tested". */
  oftenTested: boolean;
  planItemId: string | null;
  planItemKey: string | null;
  questions: number;
  /** Bonus practice on fading or due skills, as offered by Content's Review. */
  refresh: boolean;
  reinforcement: boolean;
  /** Where the block plays (`getBlockScreen`); `unknown` for a lesson block until a read adds its lesson's state (`withLessonScreens`). */
  screen: DayBlockScreen;
  /** Short subject name; null for mixed blocks and goals with fewer than two subjects. */
  subject: string | null;
  title: string | null;
  /** Why this phase challenge must wait for earlier work in this session. */
  waitReason: "challenge" | "lessons" | null;
  /** No topics are due; uses the weakest studied topics to avoid an empty day. */
  weakest: boolean;
};

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
  dailyLimit: DailyTimeLimitStatus | null;
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
  /** A day with only practice whose lessons nobody is outlining: the learner asks for them, as on an empty day's lessonsToPrepare. */
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

  return {
    ...toDayViewFields({ ...input, sessionBar: getSessionBar(session.blocks) }),
    blocks: session.blocks.map((block) =>
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
  };
}
