import { type CourseFormat, type CourseLevel } from "@zoonk/db";
import { type CourseOutlineChapter, toCoursePlanGraph } from "../../goals/_utils/course-plan-graph";
import { getExamCourseSkills } from "../../goals/_utils/exam-course-skills";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalSkillGraph } from "./save-goal-skills";

/** The Library course a goal was started from, whose outline its first run writes. */
export type StartedCourse = { id: string; ownerId: string | null; title: string };

/**
 * A goal started from a Library course learns that course: every course its skill graph names
 * becomes that one, so the goal's skills are outlined in the course's own level bands and its
 * plan is built from the course, instead of from the other courses identity search would find.
 */
export function pinGraphToCourse({
  course,
  graph,
}: {
  course: StartedCourse;
  graph: GoalSkillGraph;
}): GoalSkillGraph {
  const key = graph.courses[0]?.key ?? course.id;
  const levels = [...new Set<CourseLevel>(graph.courses.flatMap((item) => item.levels))];

  return {
    ...graph,
    courses: [{ key, levels, title: course.title }],
    skills: graph.skills.map((skill) => ({ ...skill, course: key })),
  };
}

/**
 * An exam's stored graph (`ExamSkillGraph`) as a goal started from its course plans from it
 * (`findReusableCurriculum`), the same as `pinGraphToCourse` pins a graph the goal writes: only the
 * part of the exam the course teaches (`getExamCourseSkills`, which its full outline teaches too),
 * every skill learned in that course, one skill learned in several courses is one, a skill with no
 * area takes the course's title, and the options of the exam's choices are back in the graph (the
 * learner's pick sets the others aside again). Phases with none of those skills go; sizes,
 * weights, outcomes and topics stay.
 */
export function pinPlanGraphToCourse({
  chapters = [],
  course,
  graph,
}: {
  chapters?: readonly CourseOutlineChapter[];
  course: Pick<StartedCourse, "id" | "title"> & { format: CourseFormat };
  graph: PlanGraph;
}): PlanGraph {
  const skills = getExamCourseSkills({ course, examGraph: graph });

  // A phase none of the course's skills is in is another course's: its checkpoint would check nothing.
  const phaseIndexes = [...new Set(skills.map((skill) => skill.phase))].toSorted((a, b) => a - b);
  const phases = phaseIndexes.map((index) => graph.phases[index] ?? { milestone: null, name: "" });

  const pinned = skills
    .filter(
      (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
    )
    .map(({ area, lessons, name, outcome, phase, skillId, topics = [], weight }) => ({
      area: area || course.title,
      courseIds: [course.id],
      lessons,
      name,
      ...(outcome ? { outcome } : {}),
      phase: phaseIndexes.indexOf(phase),
      skillId,
      ...(topics.length > 0 ? { topics } : {}),
      weight,
    }));

  const outlined = toCoursePlanGraph({
    chapters,
    course: { ...course, language: "en" },
    examGraph: graph,
    startChapterId: null,
  });

  const present = new Set(pinned.map((skill) => skill.skillId));
  const areas = [...new Set(pinned.flatMap((skill) => skill.area ?? []))];

  const matches = matchAreasToSubjects({
    areas: outlined.skills.flatMap((skill) => skill.area ?? []),
    subjects: areas.map((name) => ({ name })),
  });

  // An earlier outline may teach more specific skills than the reused graph names. Keep its
  // real lessons in their published exam area before that area's work still to be outlined.
  const additions = outlined.skills.flatMap((skill) => {
    const area = areas[matches.get(skill.area ?? "") ?? -1];
    const anchor = pinned.find((item) => item.area === area);

    return !present.has(skill.skillId) && area && anchor
      ? [{ ...skill, area, phase: anchor.phase, weight: skill.weight ?? anchor.weight }]
      : [];
  });

  const firstInArea = new Set<string>();

  const withOutline = pinned.flatMap((skill) => {
    const area = skill.area ?? "";

    if (firstInArea.has(area)) {
      return [skill];
    }

    firstInArea.add(area);
    return [...additions.filter((item) => item.area === area), skill];
  });

  return {
    phases: phases.map((phase) => ({ milestone: phase.milestone ?? "", name: phase.name })),
    skills: withOutline,
  };
}

/**
 * Who a started course's curriculum is for: the course's own audience, so a shared course stays
 * shared and the learner's private one stays theirs. The course already says what's shareable,
 * so no model decides it.
 */
export function getStartedCourseScope({
  course,
  goal,
}: {
  course: StartedCourse;
  goal: { language: string; targetLanguage: string | null; title: string };
}): CurriculumScope {
  return {
    generalGoal: course.ownerId ? null : goal.title,
    language: goal.language,
    ownerId: course.ownerId,
    targetLanguage: goal.targetLanguage,
  };
}

/** Each of the graph's course keys points at the started course. */
export function toStartedCourseIds({
  course,
  graph,
}: {
  course: StartedCourse;
  graph: GoalSkillGraph;
}): Record<string, string> {
  return Object.fromEntries(graph.courses.map((item) => [item.key, course.id]));
}
