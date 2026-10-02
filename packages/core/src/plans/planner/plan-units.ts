/** A Library lesson that teaches some of the goal's skills, in its chapter's order. */
export type PlannerLesson = {
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
  lessons: number;
  name: string;
  phase: number;
  skillId: string;
};

/**
 * One thing to do in order: a lesson, the lessons of a skill the Library hasn't outlined yet (one
 * placeholder the plan expands later), or a phase checkpoint. `minutes` is the time the unit
 * itself takes at the learner's pace, before reviews and practice around it.
 */
export type QueueUnit = {
  area: string;
  chapterId: string | null;
  key: string;
  kind: "boss" | "lesson";
  lessonId: string | null;
  minutes: number;
  phase: number;
  skillId: string | null;
  title: string;
};

/** A lesson is about 3 minutes; the graph sizes skills in these lessons. */
export const DEFAULT_LESSON_MINUTES = 3;

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

function toLessonUnit({
  lesson,
  paceFactor,
  skill,
}: {
  lesson: PlannerLesson;
  paceFactor: number;
  skill: UnitSkill;
}): QueueUnit {
  return {
    area: skill.area,
    chapterId: lesson.chapterId,
    key: getLessonKey(lesson.lessonId),
    kind: "lesson",
    lessonId: lesson.lessonId,
    minutes: lesson.minutes * paceFactor,
    phase: skill.phase,
    skillId: skill.skillId,
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
    minutes: lessons * DEFAULT_LESSON_MINUTES * paceFactor,
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
 * The lessons each skill's stand-in plans. Changes and announcements count a stand-in as these,
 * not as the whole skill.
 */
export function getStandInLessons({
  lessons,
  skills,
}: {
  lessons: readonly PlannerLesson[];
  skills: readonly Pick<UnitSkill, "lessons" | "skillId">[];
}): Map<string, number> {
  return new Map(
    skills.map((skill) => [
      skill.skillId,
      countStandInLessons({
        lessons: skill.lessons,
        taught: lessons.filter((lesson) => lesson.skillIds.includes(skill.skillId)).length,
      }),
    ]),
  );
}

/**
 * Turns skills in teaching order into lessons: each skill's Library lessons in chapter order, a
 * lesson shared by several skills only once (under the first), and one placeholder for a skill
 * whose lessons aren't outlined yet. A skill the Library outlined only in part keeps the graph's
 * size while a chapter's worth is missing: the rest follows its lessons as a placeholder.
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
      .map((lesson) => toLessonUnit({ lesson, paceFactor, skill }));

    const missing = countStandInLessons({ lessons: skill.lessons, taught: taught.length });

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
