import "server-only";
import { type LessonSpec, type LessonSpecSkill } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type CourseLevel, type Skill, prisma } from "@zoonk/db";
import { isSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { normalizeString } from "@zoonk/utils/string";
import {
  type WriterActivityTemplate,
  describeActivityTemplates,
} from "../../activities/writer-templates";
import { type HeldBackDraft, parseHeldBackDrafts } from "../../generation/held-back-drafts";
import { type LessonWritingContext } from "../../quality/lesson-quality-gate";
import { getSiblingsChapterId } from "../../quick-lessons/quick-lesson-identity";
import { type MaterialPage, formatMaterialPages } from "../../sources/material-pages";
import { type ChapterLesson, loadChapterLessons } from "./chapter-lessons";
import { loadLessonExams, loadLessonShortAnswers } from "./lesson-exams";
import { loadLessonDocuments } from "./lesson-sources";
import { parseStoredLessonSpec } from "./stored-lesson-spec";

export type LessonWritingInputs = {
  activityTemplates: WriterActivityTemplate[];
  categories: string[];
  chapterLessons: ChapterLesson[];
  chapterTitle: string;
  courseTitle: string;
  exams: NonNullable<LessonWritingContext["exams"]>;
  heldBackDrafts: HeldBackDraft[];
  language: string;
  level: CourseLevel;
  skillIds: (string | null)[];
  spec: LessonSpec;
  material: MaterialPage[];
  ownerId: string | null;
  setup: boolean;
  sources: MaterialPage[];
  shortAnswers: boolean;
};

type LessonWritingState =
  | { status: "notClaimed" }
  | { status: "missingSpec" }
  | { inputs: LessonWritingInputs; status: "ready" };

function matchSpecSkills({
  lessonSkills,
  specSkills,
}: {
  lessonSkills: readonly Skill[];
  specSkills: readonly LessonSpecSkill[];
}): (string | null)[] {
  const byName = new Map(lessonSkills.map((skill) => [skill.normalizedName, skill.id]));
  return specSkills.map((skill) => byName.get(normalizeString(skill.name)) ?? null);
}

async function findLessonToWrite(lessonId: string) {
  return prisma.lesson.findUnique({
    include: {
      homeChapter: { include: { homeCourse: { include: { categories: true } } } },
      skills: { include: { skill: true }, orderBy: [{ createdAt: "asc" }, { skillId: "asc" }] },
    },
    omit: { summary: true },
    where: { id: lessonId },
  });
}

type LessonToWrite = NonNullable<Awaited<ReturnType<typeof findLessonToWrite>>>;

function toMaterialQuery(spec: LessonSpec): string {
  return [
    spec.title,
    spec.description,
    ...spec.skills.flatMap((skill) => [skill.name, skill.description, skill.example]),
  ].join(" ");
}

async function toWritingState(lesson: LessonToWrite): Promise<LessonWritingState> {
  const spec = parseStoredLessonSpec(lesson.spec);

  if (!spec) {
    return { status: "missingSpec" };
  }

  const goalsOf = {
    chapterId: lesson.homeChapterId,
    courseId: lesson.homeChapter?.homeCourseId ?? null,
    lessonId: lesson.id,
  };

  const [{ material, sources }, chapterLessons, exams, shortAnswers] = await Promise.all([
    loadLessonDocuments({ ...goalsOf, query: toMaterialQuery(spec) }),
    loadChapterLessons({
      chapterId: getSiblingsChapterId(lesson),
      lessonId: lesson.id,
      ownerId: lesson.ownerId,
    }),
    loadLessonExams(goalsOf),
    loadLessonShortAnswers(goalsOf),
  ]);

  const course = lesson.homeChapter?.homeCourse;

  return {
    inputs: {
      activityTemplates: describeActivityTemplates(
        spec.screens.flatMap((screen) => screen.activityTemplate ?? []),
      ),
      categories: course?.categories.map((category) => category.category) ?? [],
      chapterLessons,
      chapterTitle: lesson.homeChapter?.title ?? lesson.title,
      courseTitle: course?.title ?? lesson.homeChapter?.title ?? lesson.title,
      exams: material.length > 0 ? [] : exams,
      heldBackDrafts: parseHeldBackDrafts(lesson.heldBackDrafts),
      language: lesson.language,
      level: lesson.level,
      material,
      ownerId: lesson.ownerId,
      setup: lesson.skills.some(({ skill }) => isSetupSkillIdentityKey(skill.identityKey)),
      shortAnswers,
      skillIds: matchSpecSkills({
        lessonSkills: lesson.skills.map((item) => item.skill),
        specSkills: spec.skills,
      }),
      sources,
      spec,
    },
    status: "ready",
  };
}

export async function loadLessonWritingInputs({
  lessonId,
  workflowRunId,
}: {
  lessonId: string;
  workflowRunId: string;
}): Promise<LessonWritingState> {
  const lesson = await findLessonToWrite(lessonId);

  if (lesson?.contentStatus !== "running" || lesson.contentRunId !== workflowRunId) {
    return { status: "notClaimed" };
  }

  return toWritingState(lesson);
}

export function toWritingContext(inputs: LessonWritingInputs): LessonWritingContext {
  return {
    activityTemplates: inputs.activityTemplates,
    chapterLessons: inputs.chapterLessons,
    chapterTitle: inputs.chapterTitle,
    courseTitle: inputs.courseTitle,
    exams: inputs.exams,
    language: inputs.language,
    level: inputs.level,
    material: inputs.material.length > 0 ? formatMaterialPages(inputs.material) : undefined,
    setup: inputs.setup,
    shortAnswers: inputs.shortAnswers,
    sources: inputs.sources.length > 0 ? formatMaterialPages(inputs.sources) : undefined,
    spec: inputs.spec,
  };
}

/** Does not require a generation claim; use for reviewing already-published content. */
export async function loadPublishedLessonInputs(
  lessonId: string,
): Promise<LessonWritingInputs | null> {
  const lesson = await findLessonToWrite(lessonId);
  const state = lesson ? await toWritingState(lesson) : null;

  return state?.status === "ready" ? state.inputs : null;
}

export async function loadLessonWritingContext(
  lessonId: string,
): Promise<LessonWritingContext | null> {
  const inputs = await loadPublishedLessonInputs(lessonId);
  return inputs ? toWritingContext(inputs) : null;
}
