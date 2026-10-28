import { type Prisma } from "../../../../generated/prisma/client";
import { type SeedCourse } from "../library/types";
import { type SeedGoal, type SeedGraphSkill, type SeedPlanItem } from "./types";
import { type LearnerScope } from "./write-goal";

type CourseLesson = { chapter: string | null; key: string; skills: readonly string[] };

type GoalSkill = { key: string; lesson: string; lessons: number; phase: number };

export function listCourseLessons(course: SeedCourse): CourseLesson[] {
  return [
    ...course.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => ({
        chapter: chapter.key,
        key: lesson.key,
        skills: lesson.skills,
      })),
    ),
    ...(course.explanations ?? []).map((lesson) => ({
      chapter: null,
      key: lesson.key,
      skills: lesson.skills,
    })),
  ];
}

export function itemLessonKeys(course: SeedCourse, item: SeedPlanItem): string[] {
  if (item.lesson) {
    return [item.lesson];
  }

  const chapter = item.chapter ? course.chapters.find((entry) => entry.key === item.chapter) : null;
  return chapter ? chapter.lessons.map((lesson) => lesson.key) : [];
}

function listGoalSkills(goal: SeedGoal): GoalSkill[] {
  const lessons = listCourseLessons(goal.course);
  const sizes = goal.plan.skillLessons ?? {};

  const skills = goal.plan.items.flatMap((item) =>
    itemLessonKeys(goal.course, item).flatMap((lessonKey) => {
      const skillKeys = lessons.find((lesson) => lesson.key === lessonKey)?.skills ?? [];

      return skillKeys.map((key) => ({
        key,
        lesson: lessonKey,
        lessons: sizes[key] ?? lessons.filter((lesson) => lesson.skills.includes(key)).length,
        phase: item.phase,
      }));
    }),
  );

  return skills.filter(
    (skill, index) => skills.findIndex((other) => other.key === skill.key) === index,
  );
}

function toGraphSkills(scope: LearnerScope, graph: readonly SeedGraphSkill[]) {
  const { learner, lookup } = scope;

  return graph.map((entry) => ({
    area: entry.area.in(learner.language),
    lessons: entry.lessons,
    name: lookup.skillName(entry.skill),
    ...(entry.outcome && { outcome: true }),
    phase: entry.phase,
    skillId: lookup.skill(entry.skill),
    topics: entry.topics.map((topic) => topic.in(learner.language)),
    weight: entry.weight,
  }));
}

export function buildPlanGraph(scope: LearnerScope, goal: SeedGoal): Prisma.InputJsonObject {
  const { lookup } = scope;

  const phases = goal.plan.phases.map((phase) => ({
    milestone: phase.milestone ?? null,
    name: phase.name,
  }));

  if (goal.plan.graph) {
    return { phases, skills: toGraphSkills(scope, goal.plan.graph) };
  }

  return {
    phases,
    skills: listGoalSkills(goal).map((skill) => {
      const lesson = lookup.lesson(skill.lesson);
      const chapter = lesson.chapterKey ? lookup.chapter(lesson.chapterKey) : null;

      return {
        area: chapter?.area ?? lookup.courseTitle,
        lessons: skill.lessons,
        name: lookup.skillName(skill.key),
        ...(chapter?.writtenTest && { outcome: true }),
        phase: skill.phase,
        skillId: lookup.skill(skill.key),
        weight: chapter?.weight ?? null,
      };
    }),
  };
}
