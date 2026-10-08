import { type GoalKind } from "@zoonk/db";
import { findAnnouncedLessonIds } from "./announced-lessons";
import { getFoundationSkillIds, getSkillArea, getWrittenTestAreas } from "./graph-areas";
import { type ExistingPlanItem } from "./plan-items";
import { getLearningShare } from "./plan-phases";
import { type PlanGraph, type PlanGraphSkill, type PlanSettings } from "./plan-state";
import {
  BOSS_MINUTES,
  DEFAULT_LESSON_MINUTES,
  type PlannerLesson,
  type QueueUnit,
  addPhaseCheckpoints,
  assignLessonSkills,
  buildLessonUnits,
  countStandInLessons,
} from "./plan-units";
import {
  FOCUS_WEIGHT_FACTOR,
  type SkillReadiness,
  getExamValue,
  inheritValues,
  isRecalled,
  keepTeachingOrder,
  orderSkills,
} from "./skill-order";

type QueueInput = {
  /** What the questions a class test's material announces ask (see `findAnnouncedLessonIds`). */
  announcements?: readonly string[];
  goal: { kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  items: readonly Pick<ExistingPlanItem, "kind" | "lessonId" | "skillId" | "status">[];
  lessons: readonly PlannerLesson[];
  paceFactor: number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  readiness: ReadonlyMap<string, SkillReadiness>;
  settings: PlanSettings;
  strongAreas?: ReadonlySet<string>;
};

type RankedSkill = PlanGraphSkill & {
  area: string;
  focused: boolean;
  index: number;
  /** Its area is one the learner wants less of (see `PlanSettings.reducedAreas`). */
  reduced: boolean;
  /** Minutes it takes at the learner's pace, its outlined lessons and stand-in together. */
  minutes: number;
  /** What the skill is worth to the exam now: its weight, the learner's gap and their focus. */
  value: number;
  /** Its value, or that of the most valuable skill it opens when it's worth more: its rank. */
  rank: number;
};

/** An area that is worth nothing right now still gets its turn in the study cycle, last. */
const MIN_AREA_RATE = 1e-6;

/**
 * A written test's protected share of the study cycle, as a part of what an average subject gets:
 * however well the learner already writes, graded writing keeps coming back every week.
 */
const WRITTEN_TEST_MIN_SHARE = 0.5;

/** Exam plans with a date put time where it pays; other plans follow the graph's phases. */
export function isExamSchedule(goal: QueueInput["goal"]): boolean {
  return goal.kind === "exam" && goal.targetDate !== null;
}

/** Minutes to learn a skill: its Library lessons, and its stand-in for what isn't outlined yet. */
function getSkillMinutes({
  input,
  skill,
  teaching,
}: {
  input: QueueInput;
  skill: PlanGraphSkill;
  /** The skill each lesson counts for (see `assignLessonSkills`): a shared lesson counts once. */
  teaching: ReadonlyMap<string, string>;
}) {
  const lessons = input.lessons.filter((lesson) => teaching.get(lesson.lessonId) === skill.skillId);

  const outlined = lessons.reduce((total, lesson) => total + lesson.minutes, 0);
  const standIn = countStandInLessons({ lessons: skill.lessons, taught: lessons.length });

  return (outlined + standIn * DEFAULT_LESSON_MINUTES) * input.paceFactor;
}

/**
 * The skills placement or a test-out found the learner knows, by the items they tested out: a
 * lesson is tested out only when the learner knows every skill it teaches, and a stand-in when
 * they know its skill. Lessons the Library outlines for them later stay out of the plan, as the
 * first ones did, so every re-plan keeps what the first build skipped. Undoing the test-out
 * brings its items back to do, and the skills with them.
 */
export function getSettledSkillIds({
  items,
  lessons,
}: Pick<QueueInput, "items" | "lessons">): Set<string> {
  const taughtBy = new Map(lessons.map((lesson) => [lesson.lessonId, lesson.skillIds]));

  return new Set(
    items.flatMap((item) => {
      if (item.kind !== "lesson" || !item.skillId) {
        return [];
      }

      if (!item.lessonId) {
        return item.status === "todo" ? [] : [item.skillId];
      }

      return item.status === "testedOut" ? (taughtBy.get(item.lessonId) ?? [item.skillId]) : [];
    }),
  );
}

/**
 * The foundations the plan moves past, so the next lessons are the ones that build on them: those
 * of each area the learner said they're past the basics of, and with "harder", those of each area
 * they're doing well in. Areas without enough answers yet keep theirs.
 */
function getHarderStartSkillIds(input: QueueInput): Set<string> {
  const strong = input.settings.difficultyBias === "harder" ? (input.strongAreas ?? []) : [];
  const areas = new Set([...strong, ...input.settings.pastBasicsAreas]);

  if (areas.size === 0) {
    return new Set();
  }

  const foundations = getFoundationSkillIds(input.graph);

  return new Set(
    input.graph.skills
      .filter(
        (skill) =>
          foundations.has(skill.skillId) && areas.has(getSkillArea({ graph: input.graph, skill })),
      )
      .map((skill) => skill.skillId),
  );
}

/**
 * Whether the learner focused on a skill: its area is in focus, whole or in the part they named
 * ("biologia e química" of a sciences area that also holds physics).
 */
function isFocused({
  area,
  settings,
  skillId,
}: {
  area: string;
  settings: PlanSettings;
  skillId: string;
}): boolean {
  const part = settings.focusParts.find((focusPart) => focusPart.area === area);
  return settings.focusAreas.includes(area) && (!part || part.skillIds.includes(skillId));
}

/**
 * How much a skill counts for where the learner steers the plan: double in an area they focus on,
 * half in one they want less of ("menos Filosofia"), so its depth and the time it takes go to the
 * others first while it keeps its turn.
 */
function getSteerFactor({ focused, reduced }: { focused: boolean; reduced: boolean }): number {
  if (focused) {
    return FOCUS_WEIGHT_FACTOR;
  }

  return reduced ? 1 / FOCUS_WEIGHT_FACTOR : 1;
}

/** Each phase's last skill in the graph's order: what the phase ends with, its milestone. */
function getPhaseEnds(graph: PlanGraph): Set<string> {
  const lastOf = graph.skills.reduce(
    (last, skill) => last.set(skill.phase, skill.skillId),
    new Map<number, string>(),
  );

  return new Set(lastOf.values());
}

/**
 * The phase each skill is studied in. A goal's outcome skills outside exams (a career change's
 * portfolio and job search) are studied as soon as the skills they build on are learned, in the
 * phase of the latest of them, instead of after every other phase: career changers learn best
 * building each portfolio piece with the skill it shows, so the first project starts while they
 * learn, not months later. An outcome skill that builds on nothing keeps its phase, and so does a
 * phase's last skill (the finished case study a portfolio phase ends with), so no phase is left
 * empty.
 */
function getStudyPhases(input: QueueInput): Map<string, number> {
  const isExam = input.goal.kind === "exam";
  const phaseEnds = getPhaseEnds(input.graph);

  return input.graph.skills.reduce((phases, skill) => {
    const required = input.prerequisites.get(skill.skillId) ?? [];
    const stays = !skill.outcome || required.length === 0 || phaseEnds.has(skill.skillId);

    if (isExam || stays) {
      return phases.set(skill.skillId, skill.phase);
    }

    const reached = Math.max(...required.map((id) => phases.get(id) ?? skill.phase));
    return phases.set(skill.skillId, Math.min(skill.phase, reached));
  }, new Map<string, number>());
}

function rankSkills(input: QueueInput): RankedSkill[] {
  const skipped = new Set(input.settings.skippedAreas);
  const settled = getSettledSkillIds(input);
  const pastStart = getHarderStartSkillIds(input);
  const phases = getStudyPhases(input);

  const studied = input.graph.skills
    .map((skill, index) => ({ area: getSkillArea({ graph: input.graph, skill }), index, skill }))
    .filter(
      ({ area, skill }) =>
        !skipped.has(area) && !settled.has(skill.skillId) && !pastStart.has(skill.skillId),
    );

  // The same skills `buildLessonUnits` plans, so a lesson counts for the same skill in both.
  const teaching = assignLessonSkills({
    lessons: input.lessons,
    skills: studied.map(({ index, skill }) => ({ ...skill, index })),
  });

  const kept = studied.map(({ area, index, skill }) => {
    const focused = isFocused({ area, settings: input.settings, skillId: skill.skillId });
    const reduced = !focused && input.settings.reducedAreas.includes(area);

    const value = getExamValue({
      readiness: input.readiness.get(skill.skillId),
      weight: (skill.weight ?? 1) * getSteerFactor({ focused, reduced }),
    });

    const minutes = getSkillMinutes({ input, skill, teaching });

    // An exam's written test (its outcome skills) gets its time from its share of the score, with
    // a protected floor (see `withWrittenTestFloor`), and its cores are cut like any other subject's
    // when time is short. Kept whole, every one of its cores outlived the other subjects' and
    // filled the plan's last days with nothing else.
    const outcome = skill.outcome === true && !isExamSchedule(input.goal);

    const phase = phases.get(skill.skillId) ?? skill.phase;

    return { ...skill, area, focused, index, minutes, outcome, phase, reduced, value };
  });

  const ranks = inheritValues({
    prerequisites: input.prerequisites,
    values: new Map(kept.map((skill) => [skill.skillId, skill.value])),
  });

  return kept.map((skill) => ({ ...skill, rank: ranks.get(skill.skillId) ?? skill.value }));
}

/**
 * Phase by phase; inside a phase, an outcome skill as soon as what it builds on is learned (see
 * `getStudyPhases`), then focused areas, the ones the learner wants less of last, then the
 * graph's order.
 */
function compareByPhase(a: RankedSkill, b: RankedSkill): number {
  return (
    a.phase - b.phase ||
    Number(b.outcome) - Number(a.outcome) ||
    Number(b.focused) - Number(a.focused) ||
    Number(a.reduced) - Number(b.reduced) ||
    a.index - b.index
  );
}

/**
 * An exam's teaching order: phase by phase, so foundations come first, and inside a phase the
 * skills worth more to the exam first (its weight, the learner's gap and focus; a prerequisite
 * counts as the skill it opens), so a plan short on time leaves out what pays least.
 */
function compareExamSkills(a: RankedSkill, b: RankedSkill): number {
  return (
    a.phase - b.phase ||
    Number(b.focused) - Number(a.focused) ||
    Number(a.reduced) - Number(b.reduced) ||
    b.rank - a.rank ||
    a.index - b.index
  );
}

/**
 * Each area's share of an exam's study days: what its skills are worth on average, minute for
 * minute (the exam's weight on them, the learner's gaps and focus), so time goes where it pays,
 * with a written test kept at no less than its protected share (see `withWrittenTestFloor`).
 */
function getAreaRates({
  graph,
  skills,
}: {
  graph: PlanGraph;
  skills: readonly RankedSkill[];
}): Map<string, number> {
  return withWrittenTestFloor({
    rates: getWorthRates(skills),
    written: getWrittenTestAreas(graph),
  });
}

/**
 * A written test's rate raised to `WRITTEN_TEST_MIN_SHARE` of the other subjects' average: the
 * exam's weight on it times the learner's gap there says how much time it gets, and a learner
 * who already writes well still practices it every week instead of only once the others are done.
 */
function withWrittenTestFloor({
  rates,
  written,
}: {
  rates: ReadonlyMap<string, number>;
  written: ReadonlySet<string>;
}): Map<string, number> {
  const others = [...rates].filter(([area]) => !written.has(area)).map(([, rate]) => rate);

  if (others.length === 0) {
    return new Map(rates);
  }

  const floor =
    (WRITTEN_TEST_MIN_SHARE * others.reduce((sum, rate) => sum + rate, 0)) / others.length;

  return new Map(
    [...rates].map(([area, rate]) => [area, written.has(area) ? Math.max(rate, floor) : rate]),
  );
}

/** Each area's rate from what its skills are worth on average, minute for minute. */
function getWorthRates(skills: readonly RankedSkill[]): Map<string, number> {
  const totals = skills.reduce((areas, skill) => {
    const total = areas.get(skill.area) ?? { minutes: 0, worth: 0 };
    const minutes = Math.max(skill.minutes, 1);

    return areas.set(skill.area, {
      minutes: total.minutes + minutes,
      worth: total.worth + skill.value * minutes,
    });
  }, new Map<string, { minutes: number; worth: number }>());

  return new Map(
    [...totals].map(([area, total]) => [
      area,
      Math.max(MIN_AREA_RATE, total.worth / total.minutes),
    ]),
  );
}

/**
 * The plan's lessons in the order to learn them: phase by phase with focused areas first (an
 * exam's skills worth more first inside a phase), every prerequisite first, and a skill placement
 * or a test-out settled left out. An exam's `rates` say what each of its areas is worth, which
 * its study cycle shares the days by (see `arrangeStudyCycle`). Learn plans and exam plans without
 * a date close each phase with a checkpoint, which takes its 10 minutes out of the day's time like
 * the reviews around lessons do.
 */
export function buildPlanQueue(queueInput: QueueInput): {
  /** The planned skills the learner focused on (their area, or the part of it they named). */
  focused: Set<string>;
  /** The prerequisites the order kept: the ones that agree with the graph's teaching order. */
  prerequisites: Map<string, string[]>;
  /**
   * What each planned skill is worth to the goal now, counting what it opens (`RankedSkill.rank`):
   * a plan short on time gives the depth of the skills worth most first.
   */
  ranks: Map<string, number>;
  /** An exam's areas and what each is worth; null for other goals, whose days follow the queue. */
  rates: Map<string, number> | null;
  /**
   * The planned skills the learner has recalled (see `isRecalled`): a plan short on time cuts what
   * they showed they know before their gaps.
   */
  recalled: Set<string>;
  units: QueueUnit[];
  /**
   * What each planned skill is worth to the goal on its own (`RankedSkill.value`): a plan short on
   * time keeps the cores worth most for their time.
   */
  values: Map<string, number>;
} {
  const input = {
    ...queueInput,
    prerequisites: keepTeachingOrder({
      prerequisites: queueInput.prerequisites,
      skillIds: queueInput.graph.skills.map((skill) => skill.skillId),
    }),
  };

  const isExam = input.goal.kind === "exam";

  const ordered = orderSkills({
    compare: isExam ? compareExamSkills : compareByPhase,
    prerequisites: input.prerequisites,
    skills: rankSkills(input),
  });

  const announced = findAnnouncedLessonIds({
    announcements: input.announcements ?? [],
    lessons: input.lessons,
  });

  const units = buildLessonUnits({
    lessons: input.lessons,
    paceFactor: input.paceFactor,
    skills: ordered,
  }).map((unit) =>
    unit.lessonId && announced.has(unit.lessonId) ? { ...unit, announced: true } : unit,
  );

  const rates = isExam ? getAreaRates({ graph: input.graph, skills: ordered }) : null;
  const ranks = new Map(ordered.map((skill) => [skill.skillId, skill.rank]));
  const values = new Map(ordered.map((skill) => [skill.skillId, skill.value]));
  const focused = new Set(ordered.filter((skill) => skill.focused).map((skill) => skill.skillId));

  const recalled = new Set(
    ordered
      .filter((skill) => isRecalled(input.readiness.get(skill.skillId)))
      .map((skill) => skill.skillId),
  );

  // An explain question is one quick explanation: there is no phase to close with a checkpoint,
  // and a dated exam's phases are time windows that close with their own checkpoints.
  if (isExamSchedule(input.goal) || input.goal.kind === "explain") {
    return { focused, prerequisites: input.prerequisites, ranks, rates, recalled, units, values };
  }

  const share = getLearningShare({ phaseKind: "learn", practiceBias: input.settings.practiceBias });

  const withCheckpoints = addPhaseCheckpoints({
    phaseNames: input.graph.phases.map((phase) => phase.name),
    units,
  }).map((unit) => (unit.kind === "boss" ? { ...unit, minutes: BOSS_MINUTES * share } : unit));

  return {
    focused,
    prerequisites: input.prerequisites,
    ranks,
    rates,
    recalled,
    units: withCheckpoints,
    values,
  };
}
