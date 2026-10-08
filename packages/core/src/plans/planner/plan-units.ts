import { type CourseLevel } from "@zoonk/db";

/** A Library lesson that teaches some of the goal's skills, in its chapter's order. */
export type PlannerLesson = {
  /** The band of the course chapter the plan takes it from; null or absent when unplaced. */
  band?: CourseLevel | null;
  chapterId: string | null;
  lessonId: string;
  minutes: number;
  /** The goal's skills this lesson teaches. */
  skillIds: readonly string[];
  title: string;
};

/** A skill in teaching order with what the planner needs to turn it into lessons. */
export type UnitSkill = {
  area: string;
  /** In an area the learner asked to focus on: its depth comes before other areas' depth. */
  focused?: boolean;
  /**
   * Its place in the graph's teaching order, which a chapter tagged with several skills teaches
   * them in; its place among the skills when absent.
   */
  index?: number;
  lessons: number;
  name: string;
  /** One of the goal's outcome skills (see `PlanGraphSkill`): its lessons are never left out first. */
  outcome?: boolean;
  phase: number;
  /** In an area the learner wants less of: its depth comes after other areas' depth. */
  reduced?: boolean;
  skillId: string;
};

/**
 * One thing to do in order: a lesson, the lessons of a skill the Library hasn't outlined yet (one
 * placeholder the plan expands later), or a phase checkpoint. `minutes` is the time the unit
 * itself takes at the learner's pace, before reviews and practice around it.
 */
export type QueueUnit = {
  /**
   * A lesson on what a question the class test's material announces asks: a plan short on time
   * keeps it with its skill's core and its skill first (see `putCoresFirst`, `rankCores`).
   */
  announced?: boolean;
  area: string;
  /**
   * The unit starts a new day of an exam's study cycle: what the day before left (minutes a lesson
   * didn't fit in) stays unused instead of taking the next day's first lesson.
   */
  opensDay?: boolean;
  /**
   * Where in the plan's lesson minutes the unit starts at the earliest: after days the study cycle
   * left without lessons, such as the weeks before a written test the learner practices only in
   * the final weeks.
   */
  startsAt?: number;
  chapterId: string | null;
  /**
   * Lessons past its skill's core, which a plan short on time studies once every skill's core is
   * in (see `putCoresFirst`).
   */
  depth?: boolean;
  /**
   * A lesson of an area the learner asked to focus on: a plan short on time studies its depth
   * before other areas' depth (see `putCoresFirst`).
   */
  focused?: boolean;
  key: string;
  kind: "boss" | "lesson";
  lessonId: string | null;
  /** The lessons a stand-in plans; absent for a lesson, which is one. */
  lessons?: number;
  minutes: number;
  /** A lesson of one of the goal's outcome skills: a plan short on time leaves others out first. */
  outcome?: boolean;
  phase: number;
  /**
   * A lesson of an area the learner wants less of: a plan short on time studies its depth after
   * other areas' depth (see `putCoresFirst`).
   */
  reduced?: boolean;
  skillId: string | null;
  title: string;
};

/**
 * How long a lesson not written yet takes, the single estimate every plan and session uses for one:
 * the lessons written so far average 3.8 minutes in their specs (8.7 screens; 695 lessons, 7 Oct
 * 2026), and a learner's own took 4.4 at the median. Written lessons keep their own estimate, so a
 * plan stays the same length when its stand-ins become lessons. The graph sizes skills in these.
 */
export const DEFAULT_LESSON_MINUTES = 4;

/** A phase checkpoint is about 10 mixed questions. */
export const BOSS_MINUTES = 10;

export function getLessonKey(lessonId: string) {
  return `lesson:${lessonId}`;
}

export function getSkillKey(skillId: string) {
  return `skill:${skillId}`;
}

export function getBossKey(phase: number) {
  return `boss:${phase}`;
}

/**
 * A lesson in the plan: planned where `skill` is taught (`phase` included, so a chapter shared by
 * several skills stays whole in its place), counting for the skill it `teaches`.
 */
function toLessonUnit({
  lesson,
  paceFactor,
  skill,
  teaches,
}: {
  lesson: PlannerLesson;
  paceFactor: number;
  skill: UnitSkill;
  teaches: UnitSkill;
}): QueueUnit {
  return {
    area: teaches.area,
    chapterId: lesson.chapterId,
    key: getLessonKey(lesson.lessonId),
    kind: "lesson",
    lessonId: lesson.lessonId,
    minutes: lesson.minutes * paceFactor,
    ...(teaches.focused ? { focused: true } : {}),
    ...(teaches.outcome ? { outcome: true } : {}),
    ...(teaches.reduced ? { reduced: true } : {}),
    phase: skill.phase,
    skillId: teaches.skillId,
    title: lesson.title,
  };
}

function toPlaceholderUnit({
  lessons,
  paceFactor,
  skill,
}: {
  /** The lessons it stands for: the whole skill, or the part not outlined yet. */
  lessons: number;
  paceFactor: number;
  skill: UnitSkill;
}) {
  return {
    area: skill.area,
    chapterId: null,
    key: getSkillKey(skill.skillId),
    kind: "lesson",
    lessonId: null,
    lessons,
    minutes: lessons * DEFAULT_LESSON_MINUTES * paceFactor,
    ...(skill.focused ? { focused: true } : {}),
    ...(skill.outcome ? { outcome: true } : {}),
    ...(skill.reduced ? { reduced: true } : {}),
    phase: skill.phase,
    skillId: skill.skillId,
    title: skill.name,
  } satisfies QueueUnit;
}

/**
 * A skill taught in part keeps the graph's size while at least this many of its lessons aren't
 * outlined: the fewest a chapter holds, so the skill's next chapter can fill the gap. Smaller gaps
 * are the graph's estimate being rough (skills of small and medium goals miss at most three), so
 * those skills plan only their outlined lessons and the plan can still finish.
 */
const MIN_STAND_IN_LESSONS = 4;

/**
 * The lessons a skill's stand-in plans, from the graph's size and the Library lessons that teach
 * it: all of them when none does, the rest when a chapter's worth or more is missing, else none.
 * The queue, the estimate, change counts and the next chapters the Library writes all follow it.
 */
export function countStandInLessons({ lessons, taught }: { lessons: number; taught: number }) {
  if (taught === 0) {
    return lessons;
  }

  const missing = lessons - taught;
  return missing >= MIN_STAND_IN_LESSONS ? missing : 0;
}

/**
 * Shares `total` lessons among skills in proportion to what each still needs (largest remainder,
 * ties to the earlier skill), then gives every skill at least one, from the largest share, when
 * there are enough to go round.
 */
function apportion({ needs, total }: { needs: readonly number[]; total: number }): number[] {
  const sum = needs.reduce((acc, need) => acc + need, 0);
  const exact = needs.map((need) => (sum > 0 ? (total * need) / sum : total / needs.length));
  const whole = exact.map((share) => Math.floor(share));
  const left = total - whole.reduce((acc, count) => acc + count, 0);

  const extra = new Set(
    exact
      .map((share, index) => ({ index, remainder: share - (whole[index] ?? 0) }))
      .toSorted((a, b) => b.remainder - a.remainder || a.index - b.index)
      .slice(0, left)
      .map((entry) => entry.index),
  );

  const counts = whole.map((count, index) => count + (extra.has(index) ? 1 : 0));

  if (total < needs.length) {
    return counts;
  }

  return counts.reduce<number[]>((shares, count, index) => {
    if (count > 0) {
      return shares;
    }

    const largest = shares.indexOf(Math.max(...shares));

    return shares.map((share, at) => {
      if (at === index) {
        return 1;
      }

      return at === largest ? share - 1 : share;
    });
  }, counts);
}

/**
 * The skill each lesson is planned under. A lesson that teaches one of the skills is that skill's.
 * A chapter an outline tagged with several skills teaches them one after another, in teaching
 * order, so the lessons it shares among the same skills are split into runs in that order, each
 * sized by what the skill still needs (its graph size less the lessons that are its alone), so
 * every skill of the chapter gets its own lessons instead of all going to the first. Lessons no
 * skill teaches aren't planned.
 */
export function assignLessonSkills({
  lessons,
  skills,
}: {
  lessons: readonly Pick<PlannerLesson, "chapterId" | "lessonId" | "skillIds">[];
  skills: readonly Pick<UnitSkill, "index" | "lessons" | "skillId">[];
}): Map<string, string> {
  const order = new Map(skills.map((skill, position) => [skill.skillId, skill.index ?? position]));
  const sizes = new Map(skills.map((skill) => [skill.skillId, skill.lessons]));

  const taughtBy = lessons.map((lesson) => ({
    chapterId: lesson.chapterId,
    lessonId: lesson.lessonId,
    skillIds: lesson.skillIds
      .filter((skillId) => order.has(skillId))
      .toSorted((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
  }));

  const single = new Map(
    taughtBy.flatMap((lesson) =>
      lesson.skillIds.length === 1 ? [[lesson.lessonId, lesson.skillIds[0] ?? ""] as const] : [],
    ),
  );

  const alone = Map.groupBy([...single.values()], (skillId) => skillId);

  const groups = Map.groupBy(
    taughtBy.filter((lesson) => lesson.skillIds.length > 1),
    (lesson) => `${lesson.chapterId ?? ""}:${lesson.skillIds.join("+")}`,
  );

  const shared = [...groups.values()].flatMap((group) => {
    const skillIds = group[0]?.skillIds ?? [];

    const counts = apportion({
      needs: skillIds.map((skillId) =>
        Math.max(1, (sizes.get(skillId) ?? 1) - (alone.get(skillId)?.length ?? 0)),
      ),
      total: group.length,
    });

    const runs = skillIds.flatMap((skillId, index) =>
      Array.from({ length: counts[index] ?? 0 }, () => skillId),
    );

    return group.map((lesson, position) => [lesson.lessonId, runs[position] ?? ""] as const);
  });

  return new Map([...single, ...shared.filter(([, skillId]) => skillId)]);
}

function countAssigned(teaching: ReadonlyMap<string, string>): Map<string, number> {
  return [...teaching.values()].reduce(
    (counts, skillId) => counts.set(skillId, (counts.get(skillId) ?? 0) + 1),
    new Map<string, number>(),
  );
}

/**
 * The lessons each skill's stand-in plans. Changes, announcements and the Library's next chapters
 * count a stand-in as these, not as the whole skill. A lesson counts once, for the skill it's
 * planned under (see `assignLessonSkills`): a chapter of five lessons an outline tagged with five
 * skills is one lesson of each, not five of each.
 */
export function getStandInLessons({
  lessons,
  skills,
}: {
  lessons: readonly Pick<PlannerLesson, "chapterId" | "lessonId" | "skillIds">[];
  skills: readonly Pick<UnitSkill, "index" | "lessons" | "skillId">[];
}): Map<string, number> {
  const taught = countAssigned(assignLessonSkills({ lessons, skills }));

  return new Map(
    skills.map((skill) => [
      skill.skillId,
      countStandInLessons({ lessons: skill.lessons, taught: taught.get(skill.skillId) ?? 0 }),
    ]),
  );
}

/**
 * Turns skills in teaching order into lessons: each skill's Library lessons in chapter order, and
 * one placeholder for a skill whose lessons aren't outlined yet. A lesson shared by several skills
 * is planned once, where the first of them is taught, so a chapter stays whole, and counts once, for
 * the skill it teaches (see `getStandInLessons`). A skill the Library outlined only in part keeps
 * the graph's size while a chapter's worth is missing: the rest follows its lessons as a
 * placeholder.
 */
export function buildLessonUnits({
  lessons,
  paceFactor,
  skills,
}: {
  lessons: readonly PlannerLesson[];
  paceFactor: number;
  skills: readonly UnitSkill[];
}): QueueUnit[] {
  const bySkillId = new Map(skills.map((skill) => [skill.skillId, skill]));
  const teaching = assignLessonSkills({ lessons, skills });
  const counts = countAssigned(teaching);
  const firstSkill = new Map<string, string>();

  lessons.forEach((lesson) => {
    const skillId = skills.find((skill) => lesson.skillIds.includes(skill.skillId))?.skillId;

    if (skillId && !firstSkill.has(lesson.lessonId)) {
      firstSkill.set(lesson.lessonId, skillId);
    }
  });

  return skills.flatMap((skill) => {
    const taught = lessons.filter((lesson) => lesson.skillIds.includes(skill.skillId));

    const own = taught
      .filter((lesson) => firstSkill.get(lesson.lessonId) === skill.skillId)
      .map((lesson) =>
        toLessonUnit({
          lesson,
          paceFactor,
          skill,
          teaches: bySkillId.get(teaching.get(lesson.lessonId) ?? "") ?? skill,
        }),
      );

    const missing = countStandInLessons({
      lessons: skill.lessons,
      taught: counts.get(skill.skillId) ?? 0,
    });

    return missing > 0 ? [...own, toPlaceholderUnit({ lessons: missing, paceFactor, skill })] : own;
  });
}

/**
 * Adds a phase checkpoint after the last lesson of each phase. Units arrive grouped by phase, so
 * the checkpoint goes where the next phase begins; the last one closes the plan.
 */
export function addPhaseCheckpoints({
  phaseNames,
  units,
}: {
  phaseNames: readonly string[];
  units: readonly QueueUnit[];
}): QueueUnit[] {
  return units.flatMap((unit, index) => {
    const next = units[index + 1];

    if (next && next.phase === unit.phase) {
      return [unit];
    }

    const boss: QueueUnit = {
      area: unit.area,
      chapterId: null,
      key: getBossKey(unit.phase),
      kind: "boss",
      lessonId: null,
      minutes: BOSS_MINUTES,
      phase: unit.phase,
      skillId: null,
      title: phaseNames[unit.phase] ?? "",
    };

    return [unit, boss];
  });
}
