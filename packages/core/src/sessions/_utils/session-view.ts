import { type StudySessionBlock } from "@zoonk/db";
import { type StudyWeek } from "../../progress/_utils/load-study-week";
import { type BlockCheckpoint } from "../block-payload";
import { type CapsuleFormat } from "../capsules";
import { type WeekDay } from "../daily-goal";
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
  /**
   * Practice on every topic of the test, weakest first, on a day whose mock the learner's plan
   * doesn't include: it counts as their test in real conditions.
   */
  fullReview: boolean;
  /**
   * A practice block that only fixes the learner's mistakes (their drills, no practice questions),
   * as a free exam plan's day is past its first week: named for that, not as mixed practice.
   */
  mistakesOnly: boolean;
  /**
   * Practice scored net, as in exams where a wrong answer cancels a right one: statements can be
   * left blank. Swipe capsules are scored net on their own.
   */
  netScored: boolean;
  /** An exam's topic the board asks a lot, from past papers: tiles tag it "Often tested". */
  oftenTested: boolean;
  planItemId: string | null;
  planItemKey: string | null;
  questions: number;
  /** Content's "Review": bonus practice on the goal's skills that are fading or due today. */
  refresh: boolean;
  reinforcement: boolean;
  /**
   * The goal's subject the block studies ("Portuguese Language"), by its short name: Today labels
   * lessons with it. Null for blocks that mix subjects, and for goals with fewer than two.
   */
  subject: string | null;
  title: string | null;
  /** Why this phase challenge must wait for earlier work in this session. */
  waitReason: "challenge" | "lessons" | null;
  /**
   * A review of the weakest studied topics, none of them due: a day with nothing due and nothing
   * else to study gets it instead of staying empty.
   */
  weakest: boolean;
};

const NO_SKILLS: ReadonlySet<string> = new Set();
const NO_SUBJECTS: ReadonlyMap<number, string> = new Map();

export function toStudyBlockView(
  input: Omit<Parameters<typeof toDayBlockView>[0], "block"> & { block: StudySessionBlock },
): StudyBlockView {
  return { ...toDayBlockView(input), id: input.block.id };
}

export type EmptyDay = "lessonsComing" | "nothingNew";

/**
 * Where catching up stands on a day: the day's blocks that catch up (lessons earlier days left,
 * which the day opens with), how many such lessons are left in all, and the ones the day's normal
 * time doesn't fit, with how long they take: they come first on the next days, or, while they
 * take about one more day of the learner's daily time (`offered`), the learner can add them to
 * today with one tap.
 */
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
  /**
   * Catching up on lessons earlier days left (see `CatchUpView`); null when the learner is on
   * pace, and in a session's summary.
   */
  catchUp: CatchUpView | null;
  /**
   * Whether this is the learner's day now: today's session, or the day before's they're still in
   * after midnight. An earlier day's session has nothing left to open; its next step is the new day.
   */
  current: boolean;
  dailyLimit: DailyTimeLimitStatus | null;
  dayEndsAt: number;
  /**
   * Why a day with study time has no blocks: its lessons are still being outlined
   * (`lessonsComing`, the day fills in on its own), or the plan has no new lesson left for it
   * (`nothingNew`: every lesson is done or one the learner showed they know), so the day offers
   * what's still useful instead. Null when the day has blocks or no study time.
   */
  emptyDay: EmptyDay | null;
  examAccess: ExamPrepAccess;
  /**
   * The goal's exam is tomorrow (see `isExamTomorrow`): nothing of the goal comes back tomorrow,
   * so the day says what it leaves without pointing there.
   */
  examTomorrow: boolean;
  extraTime: ExtraTime;
  freshStart: StudySessionRow["freshStart"];
  /**
   * The day has blocks and holds time for more lessons still being outlined: they join its end once
   * they land, at the learner's next Open or Continue, so the learner hears more is coming instead
   * of the day growing unannounced. False otherwise, and on a day without blocks (`emptyDay` says
   * why).
   */
  lessonsComing: boolean;
  fullMeal: { bonus: number; earned: boolean; ready: boolean };
  goalId: string | null;
  /** Right answers in a row on new or due material. */
  hyperdrive: { level: number; streak: number };
  id: string;
  localDate: Date;
  /**
   * "18 of 45 min": the planned minutes of the blocks finished (see `getSessionMinutesDone`),
   * today's blocks and what the plan gives the day.
   */
  minutes: { dailyGoal: number; done: number; planned: number };
  missions: Mission[];
  nextBlockId: string | null;
  nextPosition: number | null;
  pauseSuggested: boolean;
  /**
   * The lessons the plan dates on this day that a free exam plan past its first week holds for
   * Plus (see `loadDayPlusLessons`): not part of the session, shown locked after its blocks, as
   * Plus learners see them open. Empty on any other plan.
   */
  plusLessons: PlusLesson[];
  sessionBar: { completed: number; total: number };
  status: StudySessionRow["status"];
  week: {
    days: WeekDay[];
    daysHitGoal: number;
    nextStudyDate: StudyWeek["nextStudyDate"];
    studyDays: number;
    time: StudyWeek["time"];
  };
};

/**
 * The session bar: one step per block still in the day (skipped ones leave it), filled as they're
 * done. Lessons show it in the player; the session and Today show it too.
 */
export function getSessionBar(blocks: readonly Pick<StudySessionBlock, "status">[]) {
  return {
    completed: blocks.filter((block) => block.status === "completed").length,
    total: blocks.filter((block) => block.status !== "skipped").length,
  };
}

/** The block to go on with: the one in progress, else the first not started. */
export function getNextBlockId(blocks: readonly StudySessionBlock[]): string | null {
  const next =
    blocks.find((block) => block.status === "active") ??
    blocks.find((block) => block.status === "pending");

  return next?.id ?? null;
}

/** The persisted day adds only its real session and block IDs to the shared view. */
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
