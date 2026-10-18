import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { cache } from "react";
import { toListeningExam } from "../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../exams/listening/listening-skills";
import { loadCourseExam } from "../../goals/_utils/course-exam";
import { getCourseGoalKind } from "../../goals/_utils/course-goal-kind";
import { loadCourseOutline, plansFromCourseOutline } from "../../goals/_utils/course-outline";
import { type CourseOutlineChapter, toCoursePlanGraph } from "../../goals/_utils/course-plan-graph";
import { pinPlanGraphToCourse } from "../../library/curriculum/course-start-graph";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { loadBossPlanFacts } from "../../plans/_utils/boss-plan-facts";
import { chooseExamOptionSkills } from "../../plans/_utils/exam-option-skills";
import { PACE_LESSON_LIMIT, loadPaceSamples } from "../../plans/_utils/pace-samples";
import { loadExamFacts } from "../../plans/_utils/planner-exam-facts";
import { resolveMergedSkills } from "../../plans/_utils/planner-inputs";
import { loadGoalPlannerLessons } from "../../plans/_utils/planner-lessons";
import { loadQuickBaseLessons } from "../../plans/_utils/quick-bases";
import { weighGraphForExam } from "../../plans/planner/exam-weights";
import { joinOptionSkills } from "../../plans/planner/option-skills";
import { fromIsoDate } from "../../plans/planner/plan-calendar";
import { choosePace } from "../../plans/planner/plan-pace";
import { getCourseEstimateAreas } from "./course-estimate-areas";

async function loadEstimateSourceGraph({
  chapters,
  course,
  exam,
}: {
  chapters: CourseOutlineChapter[];
  course: Pick<Course, "format" | "id" | "language" | "outlineStatus" | "title">;
  exam: Awaited<ReturnType<typeof loadCourseExam>>;
}) {
  if (!chapters.some((chapter) => chapter.lessonIds.length > 0)) {
    return null;
  }

  const fromOutline = plansFromCourseOutline({
    chapterId: null,
    chapters,
    courseFormat: course.format,
    courseId: course.id,
    examGraph: exam?.graph ?? null,
    outlineStatus: course.outlineStatus,
  });

  if (fromOutline) {
    return toCoursePlanGraph({ chapters, course, examGraph: exam?.graph, startChapterId: null });
  }

  if (!exam?.graph.skills.length || exam.blueprint.language !== course.language) {
    return null;
  }

  const courseIds = [
    ...new Set(joinOptionSkills(exam.graph).skills.flatMap((skill) => skill.courseIds ?? [])),
  ];

  const privateCourses = await prisma.course.count({
    where: { id: { in: courseIds }, visibility: "private" },
  });

  if (courseIds.length === 0 || privateCourses > 0) {
    return null;
  }

  return pinPlanGraphToCourse({ chapters, course, graph: exam.graph });
}

/**
 * Fresh public planner inputs, shared by the page's paces within its request. Passing these into
 * the result cache also changes its key after another app publishes or rewrites the outline.
 */
export const loadCourseEstimateData = cache(async (courseId: string, today: string) => {
  const course = await prisma.course.findFirst({
    omit: { landingPage: true },
    where: { id: courseId, isPublished: true, visibility: "public" },
  });

  if (!course) {
    return null;
  }

  const [chapters, exam] = await Promise.all([
    loadCourseOutline({ courseId, userId: null }),
    loadCourseExam(courseId),
  ]);

  const sourceGraph = await loadEstimateSourceGraph({ chapters, course, exam });

  if (!sourceGraph) {
    return null;
  }

  /** Pinning and outline transforms may infer areas; only original evidence can classify tags. */
  const areaSkills = new Map(
    (exam ? joinOptionSkills(exam.graph) : sourceGraph).skills.map((skill) => [
      skill.skillId,
      skill.area,
    ]),
  );

  const kind = getCourseGoalKind({
    format: course.format,
    hasExam: exam !== null,
    targetLanguage: course.targetLanguage,
  });

  const goal = {
    examBlueprintId: exam?.blueprint.id ?? null,
    kind,
    primaryCourseId: courseId,
  } as const;

  const graph = await resolveMergedSkills(
    await chooseExamOptionSkills({ choices: [], goal, graph: sourceGraph }),
  );

  const skillIds = graph.skills.map((skill) => skill.skillId);

  const [lessons, prerequisites, facts, skills, quickLessons] = await Promise.all([
    loadGoalPlannerLessons({ goal, graph, userId: null }),
    loadSkillPrerequisites(skillIds),
    loadExamFacts({ goal, graph }),
    prisma.skill.findMany({ where: { id: { in: skillIds } } }),
    loadQuickBaseLessons({
      baseChoices: skillIds.map((skillId) => ({ choice: "quick", skillId })),
    }),
  ]);

  if (lessons.length === 0) {
    return null;
  }

  const pace = choosePace(
    await loadPaceSamples({
      lessonIds: lessons.slice(0, PACE_LESSON_LIMIT).map((lesson) => lesson.lessonId),
      now: fromIsoDate(today),
      userId: null,
    }),
  );

  const bands = new Map(
    skills.flatMap((skill) => (skill.level ? [[skill.id, skill.level] as const] : [])),
  );

  // What its bosses ask, fresh from the public bank on every request and keyed into the cached
  // estimate with the rest: no learner, so no answers read.
  const placeable = [...lessons, ...quickLessons.values()];

  const bossFacts = await loadBossPlanFacts({
    chapterIds: placeable.flatMap((lesson) => lesson.chapterId ?? []),
    examBlueprintId: goal.examBlueprintId,
    goalKind: kind,
    graph,
    lessonIds: placeable.map((lesson) => lesson.lessonId),
    listeningSkillIds: getListeningSkillIds({
      exam: toListeningExam({
        examBlueprint: exam?.blueprint ?? null,
        kind,
        targetLanguage: course.targetLanguage,
      }),
      graph,
    }),
    userId: null,
  });

  return {
    areaLabels: getCourseEstimateAreas({
      chapters,
      graph: sourceGraph,
      structure: exam?.blueprint.structure,
    }),
    areaSkills,
    bands: kind === "exam" ? new Map() : bands,
    bossFacts,
    chapters,
    facts,
    graph: weighGraphForExam({
      areaShares: facts.areaShares,
      courseWeights: null,
      graph,
      topicLevels: facts.topicLevels,
    }),
    kind,
    lessons,
    pace,
    prerequisites,
    quickLessons,
    sourceGraph,
    title: course.title,
  };
});

export type CourseEstimateData = NonNullable<Awaited<ReturnType<typeof loadCourseEstimateData>>>;
