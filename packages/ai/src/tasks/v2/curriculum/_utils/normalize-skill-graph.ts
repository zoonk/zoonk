import { normalizeString } from "@zoonk/utils/string";
import { COURSE_LEVELS, type CourseLevel } from "./course-levels";
import { toExamWeight } from "./exam-weight";
import {
  pushPhasesAfterPrerequisites,
  removeCycles,
  sortSkillsTopologically,
} from "./order-skill-graph";

type RawSkillGraphSkill = {
  course: string;
  description: string;
  estimatedLessons: number;
  examWeight: number | null;
  key: string;
  level: CourseLevel;
  name: string;
  phase: number;
  prerequisites: string[];
};

export type RawSkillGraph = {
  courses: { key: string; levels: CourseLevel[]; title: string }[];
  phases: { milestone: string; title: string }[];
  skills: RawSkillGraphSkill[];
};

type SkillGraphSkill = {
  /** Unique inside the graph; prerequisites point at it. */
  key: string;
  /** One thing the learner can do, as an action. */
  name: string;
  /** The idea in one sentence. */
  description: string;
  /** Key of the course that teaches it. */
  course: string;
  level: CourseLevel;
  /** Phase number, starting at 1. */
  phase: number;
  /** Keys of the skills learned right before it. */
  prerequisites: string[];
  /** How many 3-minute lessons it takes. */
  estimatedLessons: number;
  /** How much the exam depends on it, from 1 to 5, or null outside exams. */
  examWeight: number | null;
};

type SkillGraphCourse = { key: string; title: string; levels: CourseLevel[] };

type SkillGraphPhase = {
  title: string;
  /** What the learner can do at the end of the phase. */
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

/**
 * Keeps the first skill for each key and each name. A later duplicate is
 * dropped, its prerequisites join the survivor and its key becomes an alias,
 * so edges that pointed at it still resolve.
 */
function dedupeSkills(skills: readonly RawSkillGraphSkill[]) {
  const survivors = new Map<string, RawSkillGraphSkill>();
  const aliases = new Map<string, string>();
  const keysByName = new Map<string, string>();

  for (const skill of skills) {
    const key = toKey(skill.key || skill.name);
    const name = normalizeString(skill.name);
    const survivorKey = survivors.has(key) ? key : keysByName.get(name);
    const survivor = survivorKey ? survivors.get(survivorKey) : undefined;

    if (name && survivorKey && survivor) {
      aliases.set(key, survivorKey);

      survivors.set(survivorKey, {
        ...survivor,
        prerequisites: [...survivor.prerequisites, ...skill.prerequisites],
      });
    } else if (name) {
      aliases.set(key, key);
      keysByName.set(name, key);
      survivors.set(key, { ...skill, key, name: skill.name.trim() });
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

/**
 * Courses keep the model's order and only the ones with skills. A course lists
 * every level band its skills sit in, even when the model forgot one.
 */
function normalizeCourses({
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

    return [{ key, levels, title: course.title.trim() }];
  });
}

function toHours(lessons: number): number {
  return Math.round(((lessons * STUDY_MINUTES_PER_LESSON) / MINUTES_PER_HOUR) * 10) / 10;
}

/** Removes phases left without skills and renumbers the rest from 1. */
function normalizePhases({
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
      milestone: phase.milestone.trim(),
      title: phase.title.trim(),
    })),
    skills: skills.map((skill) => ({ ...skill, phase: renumber.get(skill.phase) ?? 1 })),
  };
}

function toGraphSkill({
  aliases,
  courseKeys,
  phaseCount,
  skill,
}: {
  aliases: ReadonlyMap<string, string>;
  courseKeys: ReadonlySet<string>;
  phaseCount: number;
  skill: RawSkillGraphSkill;
}): SkillGraphSkill {
  const course = toKey(skill.course);
  const [firstCourse = ""] = courseKeys;

  return {
    course: courseKeys.has(course) ? course : firstCourse,
    description: skill.description.trim(),
    estimatedLessons: clamp({ max: MAX_SKILL_LESSONS, min: 1, value: skill.estimatedLessons }),
    examWeight: toExamWeight(skill.examWeight),
    key: skill.key,
    level: skill.level,
    name: skill.name,
    phase: clamp({ max: phaseCount, min: 1, value: skill.phase }),
    prerequisites: resolvePrerequisites({ aliases, skill }),
  };
}

/** The model answered with a graph that has no course, phase or skill: nothing to plan from. */
export class EmptySkillGraphError extends Error {
  constructor() {
    super("A skill graph needs at least one course, one phase and one skill.");
    this.name = "EmptySkillGraphError";
  }
}

/**
 * Turns the model's graph into one the planner can trust: duplicate skills
 * merged, prerequisites that point nowhere or close a cycle dropped, every
 * skill in a phase no earlier than its prerequisites, skills ordered so
 * prerequisites come first, empty phases and courses removed, and each
 * phase's size given in hours of study rather than dates.
 */
export function normalizeSkillGraph(raw: RawSkillGraph): SkillGraph {
  const courseKeys = new Set(raw.courses.map((course) => toKey(course.key)));

  if (courseKeys.size === 0 || raw.phases.length === 0 || raw.skills.length === 0) {
    throw new EmptySkillGraphError();
  }

  const { aliases, skills: uniqueSkills } = dedupeSkills(raw.skills);

  const graphSkills = uniqueSkills.map((skill) =>
    toGraphSkill({ aliases, courseKeys, phaseCount: raw.phases.length, skill }),
  );

  const ordered = sortSkillsTopologically(pushPhasesAfterPrerequisites(removeCycles(graphSkills)));
  const { phases, skills } = normalizePhases({ phases: raw.phases, skills: ordered });

  return {
    courses: normalizeCourses({ courses: raw.courses, skills }),
    estimatedHours: toHours(skills.reduce((total, skill) => total + skill.estimatedLessons, 0)),
    phases,
    skills,
  };
}
