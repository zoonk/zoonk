import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { namesMatch } from "../../../exams/_utils/name-match";
import { getSubjectShare } from "../../../exams/map/exam-map";
import { isWrittenSection } from "../../../exams/mocks/mock-plan";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getPassMarks } from "../../../library/exams/pass-marks";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import {
  getPastQuestionsSource,
  getSubjectQuestions,
} from "../../../library/exams/subject-questions";
import { getTopicFrequencySource, listTopicLevels } from "../../../library/exams/topic-frequency";
import { getTopicHeadings } from "../../../library/exams/topic-groups";
import { getWrittenPracticeView } from "../../../plans/_utils/written-practice-view";
import { readCourseWeights } from "../../../plans/planner/course-weights";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import {
  type PlanGraph,
  parsePlanGraph,
  parsePlanSettings,
} from "../../../plans/planner/plan-state";
import { type SyllabusView } from "../syllabus-contract";
import {
  type AreaCourse,
  type NoticeSubject,
  type SyllabusInput,
  type SyllabusItem,
  type SyllabusSkill,
} from "./syllabus-input";
import { getPastBasicsSkillIds, withTestedOutSkills } from "./syllabus-known-skills";
import { getSkillSubjects } from "./syllabus-subjects";

const itemSelect = {
  chapterId: true,
  kind: true,
  lessonId: true,
  phase: true,
  scheduledFor: true,
  skillId: true,
  status: true,
  titleSnapshot: true,
} as const;

/** The course weights a syllabus shows: those research found for the goal's course, if any. */
function toCourseWeights(details: Goal["details"] | undefined): SyllabusView["courseWeights"] {
  const weights = readCourseWeights(details);

  return weights
    ? {
        course: weights.course,
        edition: weights.edition,
        institution: weights.institution,
        source: weights.source,
        subjects: weights.subjects,
      }
    : null;
}

/**
 * What a subject's written test asks, from the exam's written sections named like it or its group
 * ("Prova discursiva (P3)": two discursive questions and a peça técnica).
 */
function getWrittenTasks({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: ExamStructure["subjects"][number];
}): string[] {
  const names = [subject.name, subject.group].filter((name) => name !== undefined && name !== null);

  return (structure.mock?.sections ?? [])
    .filter(
      (section) =>
        isWrittenSection({ section, structure }) &&
        names.some((name) => namesMatch(section.name, name)),
    )
    .flatMap((section) => (section.tasks ?? []).map((task) => task.description));
}

/** The exam's notice subjects (with their short names), when the goal is an exam with a blueprint. */
async function loadNotice(
  goal: Pick<Goal, "examBlueprintId" | "kind"> & Partial<Pick<Goal, "details">>,
): Promise<SyllabusInput["notice"]> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } });

  if (!blueprint) {
    return null;
  }

  const { edition, structure, topicFrequency } = readBlueprintContent(blueprint);
  const levels = listTopicLevels({ structure, topicFrequency });

  const subjects: NoticeSubject[] = structure.subjects.map((subject) => ({
    frequencySource: getTopicFrequencySource({ structure, subject }),
    group: subject.group ?? null,
    matrix: subject.matrix ?? [],
    name: subject.name,
    questions: getSubjectQuestions({ structure, subject }),
    share: getSubjectShare({ structure, subject }),
    shortName: subject.shortName ?? null,
    topicFrequency: new Map(
      levels
        .filter((level) => level.subject === subject.name)
        .map((level) => [level.topic, level.level]),
    ),
    topicHeadings: getTopicHeadings(subject.topicGroups),
    topics: subject.topics,
    writtenTasks: getWrittenTasks({ structure, subject }),
  }));

  return {
    courseWeights: toCourseWeights(goal.details),
    fromMaterial: blueprint.ownerId !== null,
    passMarks: getPassMarks(structure),
    questionsSource: getPastQuestionsSource(structure),
    subjects,
    url: edition.noticeUrl,
  };
}

function toSkills(graph: PlanGraph): SyllabusSkill[] {
  return graph.skills.map((skill) => ({
    area: getSkillArea({ graph, skill }),
    lessons: skill.lessons,
    name: skill.name,
    skillId: skill.skillId,
    topics: skill.topics ?? [],
  }));
}

/** Each area's Library course, from the first of its skills that names one. */
async function loadAreaCourses(graph: PlanGraph): Promise<Map<string, AreaCourse>> {
  const areaCourseIds = new Map(
    graph.skills
      .flatMap((skill) => {
        const courseId = skill.courseIds?.[0];
        return courseId ? [[getSkillArea({ graph, skill }), courseId] as const] : [];
      })
      .toReversed(),
  );

  const courses = await prisma.course.findMany({
    select: { id: true, imageUrl: true, title: true },
    where: { id: { in: [...new Set(areaCourseIds.values())] } },
  });

  const byId = new Map(courses.map((course) => [course.id, course]));

  return new Map(
    [...areaCourseIds].flatMap(([area, courseId]) => {
      const course = byId.get(courseId);
      return course ? [[area, { imageUrl: course.imageUrl, title: course.title }] as const] : [];
    }),
  );
}

type ContentSkill = { id: string; skillId: string };

function groupSkills(rows: readonly ContentSkill[]): Map<string, string[]> {
  return new Map(
    [...Map.groupBy(rows, (row) => row.id)].map(([id, group]) => [
      id,
      group.map((row) => row.skillId),
    ]),
  );
}

/** The skills a lesson or a chapter teaches, by lesson or chapter, oldest first. */
async function loadContentSkills(items: readonly SyllabusItem[]) {
  const unknown = items.filter((item) => !item.skillId);
  const lessonIds = unknown.flatMap((item) => item.lessonId ?? []);
  const chapterIds = unknown.flatMap((item) => (item.lessonId ? [] : (item.chapterId ?? [])));

  const [lessonRows, chapterRows] = await Promise.all([
    lessonIds.length > 0
      ? prisma.lessonSkill.findMany({
          orderBy: { createdAt: "asc" },
          select: { lessonId: true, skillId: true },
          where: { lessonId: { in: lessonIds } },
        })
      : [],
    chapterIds.length > 0
      ? prisma.chapterSkill.findMany({
          orderBy: { createdAt: "asc" },
          select: { chapterId: true, skillId: true },
          where: { chapterId: { in: chapterIds } },
        })
      : [],
  ]);

  return {
    chapters: groupSkills(chapterRows.map((row) => ({ id: row.chapterId, skillId: row.skillId }))),
    lessons: groupSkills(lessonRows.map((row) => ({ id: row.lessonId, skillId: row.skillId }))),
  };
}

function getCandidates({
  item,
  skills,
}: {
  item: SyllabusItem;
  skills: Awaited<ReturnType<typeof loadContentSkills>>;
}): string[] {
  if (item.lessonId) {
    return skills.lessons.get(item.lessonId) ?? [];
  }

  return item.chapterId ? (skills.chapters.get(item.chapterId) ?? []) : [];
}

/**
 * Lessons and chapters saved without their skill take the one they teach that the plan's graph
 * has (else their first), so they still count for a subject.
 */
async function withSkills({
  graphSkillIds,
  items,
}: {
  graphSkillIds: ReadonlySet<string>;
  items: readonly SyllabusItem[];
}): Promise<SyllabusItem[]> {
  if (items.every((item) => item.skillId)) {
    return [...items];
  }

  const skills = await loadContentSkills(items);

  const pickSkill = (item: SyllabusItem): string | null => {
    const candidates = getCandidates({ item, skills });
    return candidates.find((skillId) => graphSkillIds.has(skillId)) ?? candidates[0] ?? null;
  };

  return items.map((item) => (item.skillId ? item : { ...item, skillId: pickSkill(item) }));
}

async function loadChapterTitles(items: readonly SyllabusItem[]): Promise<Map<string, string>> {
  const chapterIds = [...new Set(items.flatMap((item) => item.chapterId ?? []))];

  const chapters = await prisma.chapter.findMany({
    select: { id: true, title: true },
    where: { id: { in: chapterIds } },
  });

  return new Map(chapters.map((chapter) => [chapter.id, chapter.title]));
}

/**
 * Everything a goal's syllabus is built from: the notice (exams), the plan's graph and settings,
 * its lessons in plan order, their chapters' titles and each area's course. Null without a plan.
 */
export async function loadSyllabusInput(
  goal: Pick<Goal, "createdAt" | "examBlueprintId" | "id" | "kind"> &
    Partial<Pick<Goal, "details" | "targetDate">>,
): Promise<SyllabusInput | null> {
  const [plan, notice] = await Promise.all([
    prisma.plan.findUnique({
      select: {
        graph: true,
        items: {
          orderBy: { position: "asc" },
          select: itemSelect,
          where: { kind: { in: ["lesson", "chapter"] } },
        },
        settings: true,
      },
      where: { goalId: goal.id },
    }),
    loadNotice(goal),
  ]);

  if (!plan) {
    return null;
  }

  const graph = parsePlanGraph(plan.graph);
  const graphSkillIds = new Set(graph.skills.map((skill) => skill.skillId));

  const [items, areaCourses, chapterTitles] = await Promise.all([
    withSkills({ graphSkillIds, items: plan.items }).then((withOwn) =>
      withTestedOutSkills({ graphSkillIds, items: withOwn }),
    ),
    loadAreaCourses(graph),
    loadChapterTitles(plan.items),
  ]);

  const settings = parsePlanSettings(plan.settings);

  return {
    areaCourses,
    chapterTitles,
    items,
    notice,
    pastBasicsSkillIds: getPastBasicsSkillIds({ graph, items, settings }),
    skills: toSkills(graph),
    skippedAreas: settings.skippedAreas,
    writtenPractice: getWrittenPracticeView({
      goal: { createdAt: goal.createdAt, kind: goal.kind, targetDate: goal.targetDate ?? null },
      graph,
      settings,
    }),
  };
}

/**
 * Each of the goal's skills by its subject's short name ("Língua Portuguesa"), for labels on
 * Today's lessons; empty for goals with fewer than two subjects. Reads only the graph, the notice
 * and the areas' courses, so a session doesn't load the whole plan for it.
 */
export async function loadSkillSubjects(
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind"> | null,
): Promise<Map<string, string>> {
  if (!goal) {
    return new Map();
  }

  const [plan, notice] = await Promise.all([
    prisma.plan.findUnique({ select: { graph: true }, where: { goalId: goal.id } }),
    loadNotice(goal),
  ]);

  const graph = parsePlanGraph(plan?.graph);

  if (graph.skills.length === 0) {
    return new Map();
  }

  const areaCourses = await loadAreaCourses(graph);
  return getSkillSubjects({ areaCourses, notice, skills: toSkills(graph) });
}
