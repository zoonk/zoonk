import { normalizeString } from "@zoonk/utils/string";
import { toPlainLine } from "@zoonk/utils/text-repairs";
import { type ExamOutline, canBuildOn, isWrittenTestSubject, placeInExam } from "../exam-outline";
import { COURSE_LEVELS, type CourseLevel } from "./course-levels";
import { toExamWeight } from "./exam-weight";
import { fitLessonBudget } from "./lesson-budget";
import {
  pushPhasesAfterPrerequisites,
  removeCycles,
  sortSkillsTopologically,
} from "./order-skill-graph";
import { toSkillNameKey } from "./skill-graph-checks";

type RawSkillGraphSkill = {
  area: string;
  course: string;
  description: string;
  estimatedLessons: number;
  examWeight: number | null;
  key: string;
  level: CourseLevel;
  name: string;
  outcome: boolean;
  phase: number;
  prerequisites: string[];
  topics: string[];
};

export type RawSkillGraph = {
  courses: { key: string; levels: CourseLevel[]; title: string }[];
  phases: { milestone: string; title: string }[];
  skills: RawSkillGraphSkill[];
};

type SkillGraphSkill = {
  key: string;
  name: string;
  description: string;
  course: string;
  /** An exam's subject as its notice names it, a learn goal's module, or a language's course. */
  area: string;
  /** In the notice's words. */
  topics: string[];
  level: CourseLevel;
  /** Starts at 1. */
  phase: number;
  prerequisites: string[];
  /** How many 3-minute lessons it takes. */
  estimatedLessons: number;
  /** 1 to 5, or null outside exams. */
  examWeight: number | null;
  /**
   * The skill turns what the learner studied into the goal's result (a career change's portfolio
   * and job search): a plan short on time keeps it whole and trims depth elsewhere.
   */
  outcome?: boolean;
};

type SkillGraphCourse = { key: string; title: string; levels: CourseLevel[] };

type SkillGraphPhase = {
  title: string;
  milestone: string;
  /** Study time at no particular pace, so the planner can turn it into dates. */
  estimatedHours: number;
};

export type SkillGraph = {
  courses: SkillGraphCourse[];
  phases: SkillGraphPhase[];
  skills: SkillGraphSkill[];
  estimatedHours: number;
};

/** A 3-minute lesson plus its share of practice and reviews, so 420 hours is about 4,200 lessons. */
const STUDY_MINUTES_PER_LESSON = 6;
const MINUTES_PER_HOUR = 60;
const MAX_SKILL_LESSONS = 60;

function clamp({ max, min, value }: { max: number; min: number; value: number }): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function toKey(value: string): string {
  return value.trim().toLowerCase();
}

/** A dropped duplicate's key becomes an alias, so edges that pointed at it still resolve. */
function dedupeSkills(skills: readonly RawSkillGraphSkill[]) {
  const survivors = new Map<string, RawSkillGraphSkill>();
  const aliases = new Map<string, string>();
  const keysByName = new Map<string, string>();

  for (const skill of skills) {
    const key = toKey(skill.key || skill.name);
    const name = toSkillNameKey(skill.name) || normalizeString(skill.name);
    const survivorKey = survivors.has(key) ? key : keysByName.get(name);
    const survivor = survivorKey ? survivors.get(survivorKey) : undefined;

    if (name && survivorKey && survivor) {
      aliases.set(key, survivorKey);

      survivors.set(survivorKey, {
        ...survivor,
        outcome: survivor.outcome || skill.outcome,
        prerequisites: [...survivor.prerequisites, ...skill.prerequisites],
        topics: [...new Set([...survivor.topics, ...skill.topics])],
      });
    } else if (name) {
      aliases.set(key, key);
      keysByName.set(name, key);
      survivors.set(key, { ...skill, key, name: toPlainLine(skill.name) });
    }
  }

  return { aliases, skills: [...survivors.values()] };
}

function resolvePrerequisites({
  aliases,
  skill,
}: {
  aliases: ReadonlyMap<string, string>;
  skill: RawSkillGraphSkill;
}): string[] {
  const keys = skill.prerequisites.flatMap((prerequisite) => {
    const key = aliases.get(toKey(prerequisite));
    return key && key !== skill.key ? [key] : [];
  });

  return [...new Set(keys)];
}

function sortLevels(levels: Iterable<CourseLevel>): CourseLevel[] {
  const present = new Set(levels);
  return COURSE_LEVELS.filter((level) => present.has(level));
}

export function normalizeCourses({
  courses,
  skills,
}: {
  courses: RawSkillGraph["courses"];
  skills: readonly SkillGraphSkill[];
}): SkillGraphCourse[] {
  const unique = [...new Map(courses.map((course) => [toKey(course.key), course])).entries()];

  return unique.flatMap(([key, course]) => {
    const courseSkills = skills.filter((skill) => skill.course === key);

    if (courseSkills.length === 0) {
      return [];
    }

    const levels = sortLevels([...course.levels, ...courseSkills.map((skill) => skill.level)]);

    return [{ key, levels, title: toPlainLine(course.title) }];
  });
}

export function toHours(lessons: number): number {
  return Math.round(((lessons * STUDY_MINUTES_PER_LESSON) / MINUTES_PER_HOUR) * 10) / 10;
}

export function normalizePhases({
  phases,
  skills,
}: {
  phases: RawSkillGraph["phases"];
  skills: readonly SkillGraphSkill[];
}): { phases: SkillGraphPhase[]; skills: SkillGraphSkill[] } {
  const used = phases
    .map((phase, index) => ({ number: index + 1, phase }))
    .filter(({ number }) => skills.some((skill) => skill.phase === number));

  const renumber = new Map(used.map(({ number }, index) => [number, index + 1]));

  return {
    phases: used.map(({ number, phase }) => ({
      estimatedHours: toHours(
        skills
          .filter((skill) => skill.phase === number)
          .reduce((total, skill) => total + skill.estimatedLessons, 0),
      ),
      milestone: toPlainLine(phase.milestone),
      title: toPlainLine(phase.title),
    })),
    skills: skills.map((skill) => ({ ...skill, phase: renumber.get(skill.phase) ?? 1 })),
  };
}

/** An exam's skill takes its subject and topics from the notice, word for word. */
function toArea({
  courseTitle,
  outline,
  skill,
}: {
  courseTitle: string;
  outline?: ExamOutline;
  skill: RawSkillGraphSkill;
}): { area: string; topics: string[] } {
  const area = skill.area.trim() || courseTitle;

  if (!outline || outline.subjects.length === 0) {
    return { area, topics: [] };
  }

  return placeInExam({ area, outline, topics: skill.topics });
}

function isWrittenTestSkill({ area, outline }: { area: string; outline?: ExamOutline }): boolean {
  const subject = outline?.subjects.find((item) => item.name === area);
  return Boolean(subject && isWrittenTestSubject(subject));
}

function toGraphSkill({
  aliases,
  courseTitles,
  outline,
  phaseCount,
  skill,
}: {
  aliases: ReadonlyMap<string, string>;
  courseTitles: ReadonlyMap<string, string>;
  outline?: ExamOutline;
  phaseCount: number;
  skill: RawSkillGraphSkill;
}): SkillGraphSkill {
  const key = toKey(skill.course);
  const [firstCourse = ""] = courseTitles.keys();
  const course = courseTitles.has(key) ? key : firstCourse;

  const placed = toArea({ courseTitle: courseTitles.get(course) ?? "", outline, skill });

  return {
    ...placed,
    course,
    description: toPlainLine(skill.description),
    estimatedLessons: clamp({ max: MAX_SKILL_LESSONS, min: 1, value: skill.estimatedLessons }),
    examWeight: toExamWeight(skill.examWeight),
    key: skill.key,
    level: skill.level,
    name: skill.name,
    outcome: skill.outcome || isWrittenTestSkill({ area: placed.area, outline }),
    phase: clamp({ max: phaseCount, min: 1, value: skill.phase }),
    prerequisites: resolvePrerequisites({ aliases, skill }),
  };
}

/**
 * A learner who picks another option never studies this one, so nothing outside it may wait for it.
 */
function dropChoicePrerequisites({
  outline,
  skills,
}: {
  outline?: ExamOutline;
  skills: SkillGraphSkill[];
}): SkillGraphSkill[] {
  if (!outline?.subjects.some((subject) => subject.choiceGroup)) {
    return skills;
  }

  const areas = new Map(skills.map((skill) => [skill.key, skill.area]));

  return skills.map((skill) => ({
    ...skill,
    prerequisites: skill.prerequisites.filter((key) =>
      canBuildOn({ area: skill.area, outline, prerequisiteArea: areas.get(key) ?? "" }),
    ),
  }));
}

export class EmptySkillGraphError extends Error {
  constructor() {
    super("A skill graph needs at least one course, one phase and one skill.");
    this.name = "EmptySkillGraphError";
  }
}

export function normalizeSkillGraph(
  raw: RawSkillGraph,
  outline?: ExamOutline,
  lessonBudget?: number | null,
): SkillGraph {
  const courseTitles = new Map(
    raw.courses.map((course) => [toKey(course.key), course.title.trim()]),
  );

  if (courseTitles.size === 0 || raw.phases.length === 0 || raw.skills.length === 0) {
    throw new EmptySkillGraphError();
  }

  const { aliases, skills: uniqueSkills } = dedupeSkills(raw.skills);

  const graphSkills = dropChoicePrerequisites({
    outline,
    skills: uniqueSkills.map((skill) =>
      toGraphSkill({ aliases, courseTitles, outline, phaseCount: raw.phases.length, skill }),
    ),
  });

  const ordered = sortSkillsTopologically(pushPhasesAfterPrerequisites(removeCycles(graphSkills)));
  const normalized = normalizePhases({ phases: raw.phases, skills: ordered });
  const { phases } = normalized;
  const skills = fitLessonBudget({ budget: lessonBudget, skills: normalized.skills });

  return {
    courses: normalizeCourses({ courses: raw.courses, skills }),
    estimatedHours: toHours(skills.reduce((total, skill) => total + skill.estimatedLessons, 0)),
    phases,
    skills,
  };
}
