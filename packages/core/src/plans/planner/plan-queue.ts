import { type GoalKind } from "@zoonk/db";
import { markAnnouncedUnits } from "./announced-lessons";
import { getAreaRates } from "./area-rates";
import { findBeyondNoticeSkillIds } from "./beyond-notice-skills";
import { type BossMinutes, getPlannedBossMinutes } from "./boss-minutes";
import { putChapterInProgressFirst } from "./chapter-in-progress";
import { getAreaFoundationIds, getSkillArea, keepWrittenTestsIn } from "./graph-areas";
import { addPhaseCheckpoints } from "./phase-checkpoints";
import { type PlanBase } from "./plan-bases";
import { type ExistingPlanItem } from "./plan-items";
import { getLearningShare } from "./plan-phases";
import { type PlanGraph, type PlanGraphSkill, type PlanSettings } from "./plan-state";
import {
  DEFAULT_LESSON_MINUTES,
  type PlannerLesson,
  type QueueUnit,
  assignLessonSkills,
  buildLessonUnits,
} from "./plan-units";
import { getSettledSkillIds } from "./settled-skills";
import {
  FOCUS_WEIGHT_FACTOR,
  type SkillReadiness,
  getExamValue,
  inheritValues,
  keepTeachingOrder,
  orderSkills,
} from "./skill-order";
import { countStandInLessons } from "./stand-in-size";

const EPSILON = 1e-6;

type QueueInput = {
  /** What the questions a class test's material announces ask (see `findAnnouncedLessonIds`). */
  announcements?: readonly string[];
  bases?: readonly PlanBase[];
  /** What each boss runs, by its key (see `getPlannedBossMinutes`). */
  bossMinutes?: BossMinutes;
  goal: { kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  items: readonly Pick<
    ExistingPlanItem,
    "chapterId" | "completedAt" | "kind" | "lessonId" | "scheduledFor" | "skillId" | "status"
  >[];
  lessons: readonly PlannerLesson[];
  /** Skills the learner missed: a basic they passed over comes back (see `getHarderStartSkillIds`). */
  missedSkillIds?: ReadonlySet<string>;
  paceFactor: number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  readiness: ReadonlyMap<string, SkillReadiness>;
  settings: PlanSettings;
  strongAreas?: ReadonlySet<string>;
};

type RankedSkill = PlanGraphSkill & {
  area: string;
  /** It teaches none of the topics the notice lists for its subject (see `findBeyondNoticeSkillIds`). */
  beyondNotice: boolean;
  focused: boolean;
  index: number;
  /** Its area is one the learner wants less of (see `PlanSettings.reducedAreas`). */
  reduced: boolean;
  /** Minutes it takes at the learner's pace, its outlined lessons and stand-in together. */
  minutes: number;
  /** What the skill is worth to the exam now: its weight, the learner's gap and their focus. */
  value: number;
  /** What it's worth without the learner's steering (more or less time on its area). */
  baseValue: number;
  /** Its value, or that of the most valuable skill it opens when it's worth more: its rank. */
  rank: number;
};

/** Exam plans with a date put time where it pays; other plans follow the graph's phases. */
export function isExamSchedule(goal: QueueInput["goal"]): boolean {
  return goal.kind === "exam" && goal.targetDate !== null;
}

/** Minutes to learn a skill: its Library lessons, and its stand-in for what isn't outlined yet. */
function getSkillMinutes({
  input,
  skill,
  taught,
}: {
  input: QueueInput;
  skill: PlanGraphSkill;
  /**
   * Each skill's lessons, the ones it counts for (see `assignLessonSkills`: a shared lesson counts
   * once), in the plan's lesson order.
   */
  taught: ReadonlyMap<string | undefined, readonly PlannerLesson[]>;
}) {
  const lessons = taught.get(skill.skillId) ?? [];

  const outlined = lessons.reduce((total, lesson) => total + lesson.minutes, 0);

  const standIn = countStandInLessons({
    lessons: skill.lessons,
    outlined: skill.outlined,
    taught: lessons.length,
  });

  return (outlined + standIn * DEFAULT_LESSON_MINUTES) * input.paceFactor;
}

/**
 * The foundations the plan moves past, so the next lessons are the ones that build on them: those
 * of each area the learner said they're past the basics of, and with "harder", those of each area
 * they're doing well in. Areas without enough answers yet keep theirs, and so does a foundation
 * the learner then missed a question on: its lessons come back.
 */
function getHarderStartSkillIds(input: QueueInput): Set<string> {
  const strong = input.settings.difficultyBias === "harder" ? (input.strongAreas ?? []) : [];
  const missed = input.missedSkillIds ?? new Set<string>();

  const foundations = getAreaFoundationIds({
    areas: new Set([...strong, ...input.settings.pastBasicsAreas]),
    graph: input.graph,
    prerequisites: input.prerequisites,
  });

  return new Set([...foundations].filter((skillId) => !missed.has(skillId)));
}

/**
 * Whether the learner focused on a skill: its area is in focus, whole or in the part they named
 * ("biology and chemistry" of a sciences area that also holds physics).
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
 * half in one they want less of ("less Philosophy"), so its depth and the time it takes go to the
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
  const beyond = findBeyondNoticeSkillIds(input.graph);

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

  const taught = Map.groupBy(input.lessons, (lesson) => teaching.get(lesson.lessonId));

  const kept = studied.map(({ area, index, skill }) => {
    const focused = isFocused({ area, settings: input.settings, skillId: skill.skillId });
    const reduced = !focused && input.settings.reducedAreas.includes(area);

    const readiness = input.readiness.get(skill.skillId);
    const baseValue = getExamValue({ readiness, weight: skill.weight ?? 1 });

    const value = getExamValue({
      readiness,
      weight: (skill.weight ?? 1) * getSteerFactor({ focused, reduced }),
    });

    const minutes = getSkillMinutes({ input, skill, taught });

    // An exam's written test (its outcome skills) gets its time from its share of the score, with
    // a protected floor (see `withWrittenTestFloor`), and its cores are cut like any other subject's
    // when time is short. Kept whole, every one of its cores outlived the other subjects' and
    // filled the plan's last days with nothing else.
    const outcome = skill.outcome === true && !isExamSchedule(input.goal);

    const phase = phases.get(skill.skillId) ?? skill.phase;

    const beyondNotice = beyond.has(skill.skillId);

    return {
      ...skill,
      area,
      baseValue,
      beyondNotice,
      focused,
      index,
      minutes,
      outcome,
      phase,
      reduced,
      value,
    };
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
 * counts as the skill it opens), so a plan short on time leaves out what pays least. A skill beyond
 * the notice comes after the skills of its phase that teach the notice's topics, so a subject
 * opens with what the exam asks; what builds on it waits for it, and the rest of it comes after
 * everything the notice asks (see `putBeyondNoticeLast`).
 */
function compareExamSkills(a: RankedSkill, b: RankedSkill): number {
  return (
    a.phase - b.phase ||
    Number(b.focused) - Number(a.focused) ||
    Number(a.reduced) - Number(b.reduced) ||
    Number(a.beyondNotice) - Number(b.beyondNotice) ||
    b.rank - a.rank ||
    a.index - b.index
  );
}

/**
 * The plan's lessons in the order to learn them: phase by phase, the rest of the chapter the
 * learner is in first in its phase (see `putChapterInProgressFirst`), then focused areas first (an
 * exam's skills worth more first inside a phase), every prerequisite first, and a skill placement
 * or a test-out settled left out. An exam's `rates` say what each of its areas is worth, which its
 * study cycle shares the days by (see `arrangeStudyCycle`). Learn plans and exam plans without a
 * date close each phase with a checkpoint, which takes its 10 minutes out of the day's time like
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

  const essentialMinutes = new Map(
    (input.bases ?? []).map((base) => [base.skillId, base.minutes.essential]),
  );

  const coreOnly = new Set(
    ordered
      .filter(
        (skill) => skill.minutes <= (essentialMinutes.get(skill.skillId) ?? -Infinity) + EPSILON,
      )
      .map((skill) => skill.skillId),
  );

  const lessonUnits = putChapterInProgressFirst({
    items: input.items,
    lessons: input.lessons,
    prerequisites: input.prerequisites,
    units: markAnnouncedUnits({
      announcements: input.announcements ?? [],
      lessons: input.lessons,
      skills: input.graph.skills,
      units: buildLessonUnits({
        lessons: input.lessons,
        paceFactor: input.paceFactor,
        prerequisites: input.prerequisites,
        preserveCourseOrder: input.goal.targetDate === null,
        skills: ordered,
      }),
    }),
  });

  const units = (
    isExam ? keepWrittenTestsIn({ graph: input.graph, units: lessonUnits }) : lessonUnits
  ).map((unit) => (coreOnly.has(unit.skillId ?? "") ? { ...unit, coreOnly: true } : unit));

  const followsCourse =
    input.goal.targetDate === null && input.lessons.some((lesson) => lesson.courseOrder);

  const rates =
    isExam && !followsCourse ? getAreaRates({ graph: input.graph, skills: ordered }) : null;

  const ranks = new Map(ordered.map((skill) => [skill.skillId, skill.rank]));
  const values = new Map(ordered.map((skill) => [skill.skillId, skill.value]));
  const focused = new Set(ordered.filter((skill) => skill.focused).map((skill) => skill.skillId));

  // An explain question is one quick explanation: there is no phase to close with a checkpoint,
  // and a dated exam's phases are time windows that close with their own checkpoints.
  if (isExamSchedule(input.goal) || input.goal.kind === "explain") {
    return { focused, prerequisites: input.prerequisites, ranks, rates, units, values };
  }

  const share = getLearningShare({ phaseKind: "learn", practiceBias: input.settings.practiceBias });

  const withCheckpoints = addPhaseCheckpoints({
    getMinutes: (phase) =>
      getPlannedBossMinutes({ bossMinutes: input.bossMinutes, goalKind: input.goal.kind, phase }) *
      share,
    phaseNames: input.graph.phases.map((phase) => phase.name),
    units,
  });

  return {
    focused,
    prerequisites: input.prerequisites,
    ranks,
    rates,
    units: withCheckpoints,
    values,
  };
}
