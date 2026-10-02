import { type GoalKind } from "@zoonk/db";
import { type ExistingPlanItem } from "./plan-items";
import { mixAreas } from "./plan-mix";
import { getLearningShare } from "./plan-phases";
import { type PlanGraph, type PlanGraphSkill, type PlanSettings } from "./plan-state";
import {
  BOSS_MINUTES,
  DEFAULT_LESSON_MINUTES,
  type PlannerLesson,
  type QueueUnit,
  addPhaseCheckpoints,
  buildLessonUnits,
  countStandInLessons,
} from "./plan-units";
import {
  FOCUS_WEIGHT_FACTOR,
  type SkillReadiness,
  getExamPriority,
  getExamValue,
  inheritValues,
  keepTeachingOrder,
  orderSkills,
} from "./skill-order";

type QueueInput = {
  goal: { kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  items: readonly Pick<ExistingPlanItem, "kind" | "lessonId" | "skillId" | "status">[];
  lessons: readonly PlannerLesson[];
  paceFactor: number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  readiness: ReadonlyMap<string, SkillReadiness>;
  settings: PlanSettings;
};

type RankedSkill = PlanGraphSkill & {
  area: string;
  focused: boolean;
  index: number;
  priority: number;
  /** What the skill is worth to the exam now, counting the skills it opens. */
  value: number;
};

/** A skill's area: the course the graph put it in, or its phase when the graph named none. */
export function getSkillArea({ graph, skill }: { graph: PlanGraph; skill: PlanGraphSkill }) {
  return skill.area ?? graph.phases[skill.phase]?.name ?? "";
}

/** Exam plans with a date put time where it pays; other plans follow the graph's phases. */
export function isExamSchedule(goal: QueueInput["goal"]): boolean {
  return goal.kind === "exam" && goal.targetDate !== null;
}

/** Minutes to learn a skill: its Library lessons, and its stand-in for what isn't outlined yet. */
function getSkillMinutes({ input, skill }: { input: QueueInput; skill: PlanGraphSkill }) {
  const lessons = input.lessons.filter((lesson) => lesson.skillIds.includes(skill.skillId));
  const outlined = lessons.reduce((total, lesson) => total + lesson.minutes, 0);
  const standIn = countStandInLessons({ lessons: skill.lessons, taught: lessons.length });

  return (outlined + standIn * DEFAULT_LESSON_MINUTES) * input.paceFactor;
}

/**
 * Skills placement or a test-out settled as a whole while they were still one stand-in item: the
 * lessons outlined for them since stay out of the plan, like the stand-in did.
 */
function getSettledSkillIds(items: QueueInput["items"]): Set<string> {
  return new Set(
    items.flatMap((item) =>
      item.kind === "lesson" && !item.lessonId && item.skillId && item.status !== "todo"
        ? [item.skillId]
        : [],
    ),
  );
}

function rankSkills(input: QueueInput): RankedSkill[] {
  const skipped = new Set(input.settings.skippedAreas);
  const focus = new Set(input.settings.focusAreas);
  const settled = getSettledSkillIds(input.items);

  const kept = input.graph.skills.flatMap((skill, index) => {
    const area = getSkillArea({ graph: input.graph, skill });

    if (skipped.has(area) || settled.has(skill.skillId)) {
      return [];
    }

    const focused = focus.has(area);

    const value = getExamValue({
      readiness: input.readiness.get(skill.skillId),
      weight: (skill.weight ?? 1) * (focused ? FOCUS_WEIGHT_FACTOR : 1),
    });

    return [{ ...skill, area, focused, index, value }];
  });

  const values = inheritValues({
    prerequisites: input.prerequisites,
    values: new Map(kept.map((skill) => [skill.skillId, skill.value])),
  });

  return kept.map((skill) => {
    const value = values.get(skill.skillId) ?? skill.value;
    const minutes = getSkillMinutes({ input, skill });

    return { ...skill, priority: getExamPriority({ minutes, value }), value };
  });
}

function compareByPriority(a: RankedSkill, b: RankedSkill): number {
  return b.priority - a.priority || a.index - b.index;
}

/** Phase by phase; inside a phase, focused areas first, then the graph's order. */
function compareByPhase(a: RankedSkill, b: RankedSkill): number {
  return a.phase - b.phase || Number(b.focused) - Number(a.focused) || a.index - b.index;
}

/** Consecutive units of the same phase, in order. */
function splitByPhase(units: readonly QueueUnit[]): QueueUnit[][] {
  return units.reduce<QueueUnit[][]>((groups, unit) => {
    const last = groups.at(-1);

    if (last && last[0]?.phase === unit.phase) {
      last.push(unit);
    } else {
      groups.push([unit]);
    }

    return groups;
  }, []);
}

/**
 * Exam days mix the exam's areas by what each is worth: across the whole plan when there's a
 * date, and inside each of the graph's phases otherwise, since their checkpoints close them.
 */
function mixExamUnits({
  input,
  isDated,
  skills,
  units,
}: {
  input: QueueInput;
  isDated: boolean;
  skills: readonly RankedSkill[];
  units: QueueUnit[];
}): QueueUnit[] {
  const rates = new Map(skills.map((skill) => [skill.skillId, skill.value]));
  const groups = isDated ? [units] : splitByPhase(units);

  return groups.flatMap((group) =>
    mixAreas({ prerequisites: input.prerequisites, rates, units: group }),
  );
}

/**
 * The plan's lessons in the order to learn them. Exam plans with a date order skills by priority
 * (what each is worth ÷ time), other plans by phase with focused areas first; either way every
 * prerequisite comes first, and a skill placement or a test-out settled stays out. Exam plans
 * then mix their areas day by day. Learn plans and exam plans without a date close each phase
 * with a checkpoint, which takes its 10 minutes out of the day's time like the reviews around
 * lessons do.
 */
export function buildPlanQueue(queueInput: QueueInput): QueueUnit[] {
  const input = {
    ...queueInput,
    prerequisites: keepTeachingOrder({
      prerequisites: queueInput.prerequisites,
      skillIds: queueInput.graph.skills.map((skill) => skill.skillId),
    }),
  };

  const isExam = isExamSchedule(input.goal);

  const ordered = orderSkills({
    compare: isExam ? compareByPriority : compareByPhase,
    prerequisites: input.prerequisites,
    skills: rankSkills(input),
  });

  const lessonUnits = buildLessonUnits({
    lessons: input.lessons,
    paceFactor: input.paceFactor,
    skills: ordered,
  });

  const units =
    input.goal.kind === "exam"
      ? mixExamUnits({ input, isDated: isExam, skills: ordered, units: lessonUnits })
      : lessonUnits;

  // An explain question is one quick explanation: there is no phase to close with a checkpoint.
  if (isExam || input.goal.kind === "explain") {
    return units;
  }

  const share = getLearningShare({ phaseKind: "learn", practiceBias: input.settings.practiceBias });

  return addPhaseCheckpoints({
    phaseNames: input.graph.phases.map((phase) => phase.name),
    units,
  }).map((unit) => (unit.kind === "boss" ? { ...unit, minutes: BOSS_MINUTES * share } : unit));
}
