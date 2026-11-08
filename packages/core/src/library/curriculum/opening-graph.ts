import { type CourseLevel } from "@zoonk/db";
import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];

/** A goal's first skill and the course that teaches it, saved before its graph is written. */
export type GoalOpeningSkill = {
  course: { id: string; key: string; title: string };
  skill: {
    area: string;
    description: string;
    estimatedLessons: number;
    id: string;
    key: string;
    level: CourseLevel;
    name: string;
  };
};

/** The graph with the opening as its start, and the Library ids the opening already saved. */
export type OpeningGraph = {
  courseIdsByKey: Record<string, string>;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
};

/**
 * The graph was told to start with the opening as given; this holds it to that by its key, so a
 * reworded, moved or missing first skill can't keep the plan from starting at the learner's first
 * lesson.
 */
export function keepOpeningFirst({
  graph,
  opening,
}: {
  graph: GoalSkillGraph;
  opening: GoalOpeningSkill | null;
}): OpeningGraph {
  if (!opening) {
    return { courseIdsByKey: {}, graph, idsByKey: {} };
  }

  const { course, skill } = opening;
  const written = graph.skills.find((item) => item.key === skill.key);

  const first: GraphSkill = {
    area: written?.area ?? skill.area,
    course: course.key,
    description: skill.description,
    estimatedLessons: written?.estimatedLessons ?? skill.estimatedLessons,
    examWeight: null,
    key: skill.key,
    level: skill.level,
    libraryId: skill.id,
    name: skill.name,
    outcome: false,
    phase: 1,
    prerequisites: [],
    topics: [],
  };

  const courses = graph.courses.some((item) => item.key === course.key)
    ? graph.courses
    : [{ key: course.key, levels: [skill.level], title: course.title }, ...graph.courses];

  return {
    courseIdsByKey: { [course.key]: course.id },
    graph: {
      ...graph,
      courses,
      skills: [first, ...graph.skills.filter((item) => item.key !== skill.key)],
    },
    idsByKey: { [skill.key]: skill.id },
  };
}
