import "server-only";
import { type LessonSpec, type LessonSpecSkill } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type CourseLevel, type Skill, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import {
  type WriterActivityTemplate,
  describeActivityTemplates,
} from "../../activities/writer-templates";
import { type HeldBackDraft, parseHeldBackDrafts } from "../../generation/held-back-drafts";
import { type LessonWritingContext } from "../../quality/lesson-quality-gate";
import { type MaterialPage, formatMaterialPages } from "../../sources/material-pages";
import { type ChapterLesson, loadChapterLessons } from "./chapter-lessons";
import { loadLessonDocuments } from "./lesson-sources";
import { parseStoredLessonSpec } from "./stored-lesson-spec";

/** What the writer, the checks and the save step need about the lesson being written. */
export type LessonWritingInputs = {
  activityTemplates: WriterActivityTemplate[];
  categories: string[];
  /** The chapter's other lessons, so this one doesn't repeat their examples, numbers or questions. */
  chapterLessons: ChapterLesson[];
  chapterTitle: string;
  courseTitle: string;
  /** Earlier drafts the quality gate held back, oldest first: the next draft is told why. */
  heldBackDrafts: HeldBackDraft[];
  language: string;
  level: CourseLevel;
  /** The Library skill of each spec skill, in spec order, or null when none matches. */
  skillIds: (string | null)[];
  spec: LessonSpec;
  /** The pages of the learner's own material a private lesson is written from; empty otherwise. */
  material: MaterialPage[];
  /**
   * Passages of the public documents the lesson's facts come from (a law, an exam notice), for
   * lessons of goals built from sources; empty for lessons built from material and all others.
   */
  sources: MaterialPage[];
};

type LessonWritingState =
  | { status: "notClaimed" }
  | { status: "missingSpec" }
  | { inputs: LessonWritingInputs; status: "ready" };

/**
 * Spec skills are matched to the lesson's Library skills by name. When names
 * differ but the counts match, the order the lesson's skills were linked in is
 * the spec's order, since both come from the same spec.
 */
function matchSpecSkills({
  lessonSkills,
  specSkills,
}: {
  lessonSkills: readonly Skill[];
  specSkills: readonly LessonSpecSkill[];
}): (string | null)[] {
  const byName = new Map(lessonSkills.map((skill) => [skill.normalizedName, skill.id]));
  const sameCount = lessonSkills.length === specSkills.length;

  return specSkills.map(
    (skill, index) =>
      byName.get(normalizeString(skill.name)) ??
      (sameCount ? lessonSkills[index]?.id : undefined) ??
      null,
  );
}

async function findLessonToWrite(lessonId: string) {
  return prisma.lesson.findUnique({
    include: {
      homeChapter: { include: { homeCourse: { include: { categories: true } } } },
      skills: { include: { skill: true }, orderBy: { createdAt: "asc" } },
    },
    omit: { summary: true },
    where: { id: lessonId },
  });
}

type LessonToWrite = NonNullable<Awaited<ReturnType<typeof findLessonToWrite>>>;

/** What the lesson teaches, to find the pages of the learner's material it's written from. */
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

  const [{ material, sources }, chapterLessons] = await Promise.all([
    loadLessonDocuments({
      chapterId: lesson.homeChapterId,
      courseId: lesson.homeChapter?.homeCourseId ?? null,
      lessonId: lesson.id,
      query: toMaterialQuery(spec),
    }),
    loadChapterLessons({
      chapterId: lesson.homeChapterId,
      lessonId: lesson.id,
      ownerId: lesson.ownerId,
    }),
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
      heldBackDrafts: parseHeldBackDrafts(lesson.heldBackDrafts),
      language: lesson.language,
      level: lesson.level,
      material,
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

/**
 * Loads what writing a lesson's content needs, after confirming this workflow
 * run holds the lesson's content claim. A lesson without a valid stored spec
 * can't be written yet.
 */
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

/** The lesson plan and course context the writer and the quality gate read. */
export function toWritingContext(inputs: LessonWritingInputs): LessonWritingContext {
  return {
    activityTemplates: inputs.activityTemplates,
    chapterLessons: inputs.chapterLessons,
    chapterTitle: inputs.chapterTitle,
    courseTitle: inputs.courseTitle,
    language: inputs.language,
    level: inputs.level,
    material: inputs.material.length > 0 ? formatMaterialPages(inputs.material) : undefined,
    sources: inputs.sources.length > 0 ? formatMaterialPages(inputs.sources) : undefined,
    spec: inputs.spec,
  };
}

/**
 * What the writer read for a lesson, whatever its claim: for a later check of a lesson already
 * published, which reviews it against the same plan.
 */
export async function loadLessonWritingContext(
  lessonId: string,
): Promise<LessonWritingContext | null> {
  const lesson = await findLessonToWrite(lessonId);
  const state = lesson ? await toWritingState(lesson) : null;

  return state?.status === "ready" ? toWritingContext(state.inputs) : null;
}
