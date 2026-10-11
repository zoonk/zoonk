import { createHash } from "node:crypto";
import { type Goal, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { loadGoalPlannerLessons } from "../../_utils/planner-lessons";
import { type PlannerLesson } from "../../planner/plan-units";
import { type SimLessonRow } from "./sim-db-lessons";
import { SIM_PROVENANCE, type SimLibrary, listSkillLinks } from "./sim-library";

/** Chapters the Library writes during a life go after a course's own, in its last band. */
const LANDED_POSITION = 10_000;
const LANDED_BAND = "advanced" as const;
const LANDED_LESSON_MINUTES = 4;
const DEFAULT_SIZE = 3;

/** The Library writes between 60% and 140% of a skill's graph size, in steps of 10%. */
const LEAST_SHARE = 0.6;
const SHARE_STEP = 0.1;
const SHARE_STEPS = 9;

/** How many lessons the Library writes for a skill it outlines during a life. */
function countWrittenLessons({ shortId, size }: { shortId: string; size: number }): number {
  const steps = createHash("sha1").update(shortId).digest().readUInt32BE(0) % SHARE_STEPS;
  return Math.max(1, Math.round(size * (LEAST_SHARE + steps * SHARE_STEP)));
}

/** The lessons the Library writes for a skill the fixture has none for (see `landSimSkills`). */
export function writeLandedLessons({
  library,
  skillId,
}: {
  library: SimLibrary;
  skillId: string;
}): PlannerLesson[] {
  const shortId = library.short(skillId);
  const skill = library.graph.skills.find((entry) => entry.skillId === skillId);
  const count = countWrittenLessons({ shortId, size: skill?.lessons ?? DEFAULT_SIZE });

  return Array.from({ length: count }, (_, index) => ({
    band: LANDED_BAND,
    chapterId: library.toId(`landed:${shortId}`),
    lessonId: library.toId(`landed:${shortId}:${index + 1}`),
    minutes: LANDED_LESSON_MINUTES,
    skillIds: [skillId],
    title: `${skill?.name ?? shortId} ${index + 1}`,
  }));
}

/** A chapter of new lessons for a skill, placed last in its course (see `writeLandedLessons`). */
async function writeChapter({
  library,
  shortId,
}: {
  library: SimLibrary;
  shortId: string;
}): Promise<SimLessonRow[]> {
  const { fixture, toId } = library;
  const skillId = toId(shortId);
  const skill = fixture.graph.skills.find((entry) => entry.skillId === shortId);
  const courseShort = skill?.courseIds?.[0] ?? fixture.goal.primaryCourse;
  const lessons = writeLandedLessons({ library, skillId });
  const chapterId = toId(`landed:${shortId}`);
  const title = skill?.name ?? shortId;
  const { language } = fixture.goal;

  await prisma.chapter.create({
    data: {
      courses: courseShort
        ? {
            create: {
              courseId: toId(courseShort),
              level: LANDED_BAND,
              position:
                LANDED_POSITION +
                fixture.graph.skills.findIndex((entry) => entry.skillId === shortId),
            },
          }
        : undefined,
      description: title,
      goalSkills: { create: { skillId } },
      id: chapterId,
      identityKey: `sim-chapter-${chapterId}`,
      language,
      lessons: {
        create: lessons.map((lesson, position) => ({
          lesson: {
            create: {
              description: lesson.title,
              estimatedMinutes: lesson.minutes,
              id: lesson.lessonId,
              identityKey: `sim-lesson-${lesson.lessonId}`,
              language,
              level: LANDED_BAND,
              normalizedTitle: normalizeString(lesson.title),
              slug: `sim-landed-${shortId}-${position + 1}`,
              title: lesson.title,
              ...SIM_PROVENANCE,
            },
          },
          position,
        })),
      },
      level: LANDED_BAND,
      normalizedTitle: normalizeString(title),
      outlineStatus: "completed",
      slug: `sim-landed-${shortId}`,
      title,
      ...SIM_PROVENANCE,
    },
  });

  // The outline ties them to the skill through their chapter: they teach finer skills of their own.
  return lessons.map((lesson) => ({
    id: lesson.lessonId,
    level: LANDED_BAND,
    skillIds: [],
    title: lesson.title,
  }));
}

/**
 * The Library outlines skills of a life's copy (short ids): a skill the fixture has lessons for
 * gets its links to them back, and one the planner still finds no lessons for gets a chapter of
 * new lessons in its course. Like the pure tier's landing, that's decided by what the planner
 * loads: a fixture chapter in another course than the skill's isn't one of its lessons. Returns
 * the new lessons.
 */
export async function landSimSkills({
  goal,
  library,
  skills,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind" | "primaryCourseId" | "userId">;
  library: SimLibrary;
  skills: readonly string[];
}): Promise<SimLessonRow[]> {
  const links = listSkillLinks({ library, skills: new Set(skills) });

  await Promise.all([
    prisma.lessonSkill.createMany({ data: links.lessonSkills, skipDuplicates: true }),
    prisma.chapterSkill.createMany({ data: links.chapterSkills, skipDuplicates: true }),
  ]);

  const lessons = await loadGoalPlannerLessons({ goal, graph: library.graph, userId: goal.userId });
  const taught = new Set(lessons.flatMap((lesson) => lesson.skillIds));
  const unwritten = skills.filter((shortId) => !taught.has(library.toId(shortId)));

  const written = await Promise.all(unwritten.map((shortId) => writeChapter({ library, shortId })));
  return written.flat();
}
