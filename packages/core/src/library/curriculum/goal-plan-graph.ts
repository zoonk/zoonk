import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";
import { type GoalSkillGraph } from "./save-goal-skills";

/**
 * A skill graph read back from a stored plan graph (`buildPlanSkillGraph`): its skills keep
 * whether their course outline is all their work (`PlanGraphSkill.outlined`), which a model never
 * writes, and whether the stored graph never said which notice topics they teach
 * (`topicsUnknown`, with `topics` then empty): an outline skill published before topics were
 * kept isn't one that teaches none of them (`findBeyondNoticeSkillIds`). A plan made from it
 * again keeps both.
 */
export type PlannedSkillGraph = Omit<GoalSkillGraph, "skills"> & {
  courseOutline?: PlanGraph["courseOutline"];
  skills: (GoalSkillGraph["skills"][number] & { outlined?: boolean; topicsUnknown?: boolean })[];
};

/**
 * The notice topics of a skill's copies: every topic any copy teaches; none when each copy says it
 * teaches none; unknown when some copy's are unknown and no copy lists one, since a skill whose
 * topics nobody knows may teach some.
 */
function mergeTopics(copies: readonly PlanGraphSkill[]): string[] | undefined {
  const listed = [...new Set(copies.flatMap((copy) => copy.topics ?? []))];

  if (listed.length > 0) {
    return listed;
  }

  return copies.every((copy) => copy.topics) ? [] : undefined;
}

/**
 * A skill the Library resolved from two graph skills keeps its first place and area, and is
 * learned in the courses of both, teaching the topics of both (`mergeTopics`): the goal needs it in
 * each subject. It's outlined only when both are: a copy whose outline isn't all its work still
 * has work to plan. An empty topic list stays only on an outlined skill, the one skill it tells
 * apart from one whose topics are unknown.
 */
function mergeDuplicateSkills(skills: readonly PlanGraphSkill[]): PlanGraphSkill[] {
  return skills
    .filter(
      (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
    )
    .map(({ outlined: _outlined, topics: _topics, ...skill }) => {
      const same = skills.filter((other) => other.skillId === skill.skillId);
      const courseIds = same.flatMap((other) => other.courseIds ?? []);
      const topics = mergeTopics(same);
      const outcome = same.some((other) => other.outcome);
      const outlined = same.every((other) => other.outlined);

      return {
        ...skill,
        courseIds: [...new Set(courseIds)],
        ...(outcome ? { outcome } : {}),
        ...(outlined ? { outlined } : {}),
        ...(topics && (topics.length > 0 || outlined) ? { topics } : {}),
      };
    });
}

/**
 * Turns a goal's skill graph into the graph the planner plans from. Phases keep their titles and
 * milestones; each skill keeps its size in lessons, its phase (counted from 0, as plans count
 * them), its exam weight, its area (an exam's notice subject or a learn goal's module, which the
 * syllabus shows, study days rotate through and "focus on math" edits act on; its course's title
 * on graphs without one), the notice topics it teaches (unknown when the graph never said), whether it's one of the goal's outcome
 * skills (kept whole when time is short), whether its course outline is all its work (read back
 * from a stored plan graph, see `PlannedSkillGraph`), and the Library course found for its course,
 * which the plan takes the skill's lessons from. The graph is already in teaching order.
 * Two graph skills that the Library resolved to the same skill become one, at the place of the
 * first.
 */
export function toGoalPlanGraph({
  courseIdsByKey,
  graph,
  idsByKey,
}: {
  /** The Library course found for each graph course, by the graph's course key. */
  courseIdsByKey: Readonly<Record<string, string>>;
  graph: PlannedSkillGraph;
  idsByKey: Readonly<Record<string, string>>;
}): PlanGraph {
  const courseTitles = new Map(graph.courses.map((course) => [course.key, course.title]));

  const skills = graph.skills.flatMap((skill) => {
    const skillId = idsByKey[skill.key];
    const courseId = courseIdsByKey[skill.course];

    if (!skillId) {
      return [];
    }

    return [
      {
        area: skill.area || (courseTitles.get(skill.course) ?? null),
        courseIds: courseId ? [courseId] : [],
        lessons: skill.estimatedLessons,
        name: skill.name,
        ...(skill.outcome ? { outcome: true } : {}),
        ...(skill.outlined ? { outlined: true } : {}),
        phase: Math.max(0, skill.phase - 1),
        skillId,
        topics: skill.topicsUnknown ? undefined : skill.topics,
        weight: skill.examWeight,
      },
    ];
  });

  return {
    ...(graph.courseOutline && { courseOutline: graph.courseOutline }),
    phases: graph.phases.map((phase) => ({ milestone: phase.milestone, name: phase.title })),
    skills: mergeDuplicateSkills(skills),
  };
}
