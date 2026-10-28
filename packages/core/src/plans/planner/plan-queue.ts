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
  announcements?: readonly string[];
  bases?: readonly PlanBase[];
  bossMinutes?: BossMinutes;
  goal: { kind: GoalKind; targetDate: Date | null };
  graph: PlanGraph;
  items: readonly Pick<
    ExistingPlanItem,
    "chapterId" | "completedAt" | "kind" | "lessonId" | "scheduledFor" | "skillId" | "status"
  >[];
  lessons: readonly PlannerLesson[];
  missedSkillIds?: ReadonlySet<string>;
  paceFactor: number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  readiness: ReadonlyMap<string, SkillReadiness>;
  settings: PlanSettings;
  strongAreas?: ReadonlySet<string>;
};

type RankedSkill = PlanGraphSkill & {
  area: string;
  beyondNotice: boolean;
  focused: boolean;
  index: number;
  reduced: boolean;
  minutes: number;
  value: number;
  baseValue: number;
  rank: number;
};

export function isExamSchedule(goal: QueueInput["goal"]): boolean {
  return goal.kind === "exam" && goal.targetDate !== null;
}

function getSkillMinutes({
  input,
  skill,
  taught,
}: {
  input: QueueInput;
  skill: PlanGraphSkill;
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

function getSteerFactor({ focused, reduced }: { focused: boolean; reduced: boolean }): number {
  if (focused) {
    return FOCUS_WEIGHT_FACTOR;
  }

  return reduced ? 1 / FOCUS_WEIGHT_FACTOR : 1;
}

function getPhaseEnds(graph: PlanGraph): Set<string> {
  const lastOf = graph.skills.reduce(
    (last, skill) => last.set(skill.phase, skill.skillId),
    new Map<number, string>(),
  );

  return new Set(lastOf.values());
}

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

  // The same assignment `buildLessonUnits` uses, so a lesson counts for the same skill in both.
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

function compareByPhase(a: RankedSkill, b: RankedSkill): number {
  return (
    a.phase - b.phase ||
    Number(b.outcome) - Number(a.outcome) ||
    Number(b.focused) - Number(a.focused) ||
    Number(a.reduced) - Number(b.reduced) ||
    a.index - b.index
  );
}

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

export function buildPlanQueue(queueInput: QueueInput): {
  focused: Set<string>;
  prerequisites: Map<string, string[]>;
  ranks: Map<string, number>;
  rates: Map<string, number> | null;
  units: QueueUnit[];
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
