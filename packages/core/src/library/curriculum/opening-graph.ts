import { toSkillNameKey } from "@zoonk/ai/tasks/curriculum/skill-graph-checks";
import { normalizeString } from "@zoonk/utils/string";
import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];
type GraphCourse = GoalSkillGraph["courses"][number];

/** A goal's saved opening: its first skill and the course that teaches it, as Library rows. */
export type GoalOpeningPin = {
  course: GraphCourse & { id: string };
  skill: GraphSkill & { libraryId: string };
};

function toFreeKey({ key, taken }: { key: string; taken: ReadonlySet<string> }): string {
  return taken.has(key) ? `${key}-opening` : key;
}

function pinCourse({ graph, pin }: { graph: GoalSkillGraph; pin: GoalOpeningPin }) {
  const title = normalizeString(pin.course.title);
  const same = graph.courses.find((course) => normalizeString(course.title) === title);
  const levels = [...new Set([...(same?.levels ?? []), ...pin.course.levels])];

  const key =
    same?.key ??
    toFreeKey({ key: pin.course.key, taken: new Set(graph.courses.map((course) => course.key)) });

  const others = graph.courses.filter((course) => course.key !== key);

  return { courses: [{ key, levels, title: same?.title ?? pin.course.title }, ...others], key };
}

/** The graph pinned to the opening, with the Library ids the opening already saved. */
export type PinnedGraph = {
  courseIdsByKey: Record<string, string>;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
};

/**
 * The graph keeps the learner's first skill, as saved, as its start: the graph's own copy of it
 * (the same skill by name) is dropped and its edges point at the opening instead, and the course
 * that teaches it comes first, so the plan's first lesson is the opening's.
 */
export function pinGraphToOpening({
  graph,
  pin,
}: {
  graph: GoalSkillGraph;
  pin: GoalOpeningPin | null;
}): PinnedGraph {
  if (!pin) {
    return { courseIdsByKey: {}, graph, idsByKey: {} };
  }

  const name = toSkillNameKey(pin.skill.name);

  const copies = new Set(
    graph.skills.filter((skill) => toSkillNameKey(skill.name) === name).map((skill) => skill.key),
  );

  const rest = graph.skills.filter((skill) => !copies.has(skill.key));
  const key = toFreeKey({ key: pin.skill.key, taken: new Set(rest.map((skill) => skill.key)) });
  const course = pinCourse({ graph, pin });

  const skills = rest.map((skill) => ({
    ...skill,
    prerequisites: [
      ...new Set(
        skill.prerequisites.map((prerequisite) => (copies.has(prerequisite) ? key : prerequisite)),
      ),
    ],
  }));

  // In the module the graph starts the course with, so a near copy of it is its twin.
  const area = skills.find((skill) => skill.course === course.key)?.area ?? pin.skill.area;

  const opening: GraphSkill = {
    ...pin.skill,
    area,
    course: course.key,
    key,
    phase: 1,
    prerequisites: [],
  };

  return {
    courseIdsByKey: { [course.key]: pin.course.id },
    graph: { ...graph, courses: course.courses, skills: [opening, ...skills] },
    idsByKey: { [key]: pin.skill.libraryId },
  };
}
