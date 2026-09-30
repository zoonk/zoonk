import "server-only";
import {
  type CourseLevel,
  type Lesson,
  type LessonUncheckedCreateInput,
  isPrismaUniqueConstraintError,
  prisma,
} from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { assertIdentityKeyScope } from "@zoonk/utils/identity-key";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import {
  type LibraryProvenance,
  createOrFindByIdentity,
  pickAvailableSlug,
  toLibraryVisibility,
  toProvenanceData,
} from "../_utils/library-rows";
import { assertHomeVisibility } from "../_utils/placement-visibility";

/**
 * What a caller already knows about a new lesson beyond its outline, written with it: the can-do
 * line session tiles show before the spec exists, or the spec itself (then `specStatus` is
 * `completed`, with the run that wrote it).
 */
export type NewLessonDetails = Partial<
  Pick<LessonUncheckedCreateInput, "canDo" | "spec" | "specRunId" | "specStatus">
>;

export type CreateLibraryLessonInput = NewLessonDetails & {
  /** The key `resolveLibraryIdentity` returned with its `generate` outcome. */
  identityKey: string;
  language: string;
  targetLanguage: string | null;
  level: CourseLevel;
  title: string;
  /** One line on why the lesson matters. */
  description: string;
  estimatedMinutes: number;
  /** The 1 to 3 skills the lesson teaches, already resolved to Library skills. */
  skillIds: string[];
  /** The chapter whose outline first needed this lesson; it gives the lesson its URL. */
  homeChapterId: string | null;
  /** Set for a private course's lesson, which only its owner ever sees. */
  ownerId: string | null;
  provenance: LibraryProvenance;
};

const lessonOmit = { spec: true, summary: true } as const;

type CreatedLesson = { created: boolean; lesson: Omit<Lesson, keyof typeof lessonOmit> };

async function findLessonByIdentity({
  identityKey,
  language,
}: Pick<CreateLibraryLessonInput, "identityKey" | "language">) {
  return prisma.lesson.findUnique({
    omit: lessonOmit,
    where: { languageIdentity: { identityKey, language } },
  });
}

async function assertLessonHome({
  homeChapterId,
  ownerId,
}: Pick<CreateLibraryLessonInput, "homeChapterId" | "ownerId">): Promise<void> {
  if (!homeChapterId) {
    return;
  }

  const chapter = await prisma.chapter.findUniqueOrThrow({ where: { id: homeChapterId } });

  assertHomeVisibility({ child: toLibraryVisibility(ownerId), home: chapter });
}

async function listHomeSlugs(homeChapterId: string | null): Promise<string[]> {
  if (!homeChapterId) {
    return [];
  }

  const lessons = await prisma.lesson.findMany({
    select: { slug: true },
    where: { homeChapterId },
  });

  return lessons.map((lesson) => lesson.slug);
}

function pickLessonSlug({ taken, title }: { taken: readonly string[]; title: string }): string {
  return pickAvailableSlug({ base: toSlug(title) || "lesson", taken });
}

async function insertLesson({ input, slug }: { input: CreateLibraryLessonInput; slug: string }) {
  return prisma.lesson.create({
    data: {
      canDo: input.canDo,
      description: input.description,
      estimatedMinutes: input.estimatedMinutes,
      homeChapterId: input.homeChapterId,
      identityKey: input.identityKey,
      language: input.language,
      level: input.level,
      normalizedTitle: normalizeString(input.title),
      skills: { create: [...new Set(input.skillIds)].map((skillId) => ({ skillId })) },
      slug,
      spec: input.spec,
      specRunId: input.specRunId,
      specStatus: input.specStatus,
      targetLanguage: input.targetLanguage,
      title: input.title,
      ...toLibraryVisibility(input.ownerId),
      ...toProvenanceData(input.provenance),
    },
    omit: lessonOmit,
  });
}

/**
 * Creates a lesson outline (title and description, content pending) for a
 * generation workflow, or returns the one a concurrent request created under
 * the same identity. Its spec and steps are written later, under a claim.
 *
 * This is a workflow bridge, not an app authorization boundary: it accepts an
 * owner id only because the public core boundary that started the workflow
 * derived it from the authenticated session.
 */
export async function createLibraryLesson(input: CreateLibraryLessonInput): Promise<CreatedLesson> {
  assertIdentityKeyScope({ key: input.identityKey, ownerId: input.ownerId });
  await assertLessonHome(input);

  const { created, row } = await createOrFindByIdentity({
    create: async () => {
      const taken = await listHomeSlugs(input.homeChapterId);
      return insertLesson({ input, slug: pickLessonSlug({ taken, title: input.title }) });
    },
    findExisting: () => findLessonByIdentity(input),
  });

  return { created, lesson: row };
}

/** Gives each new lesson a slug free in their home chapter and among the others, in order. */
function assignSlugs<T extends { title: string }>({
  lessons,
  taken,
}: {
  lessons: readonly T[];
  taken: readonly string[];
}): { lesson: T; slug: string }[] {
  return lessons.reduce<{ lesson: T; slug: string }[]>((assigned, lesson) => {
    const slug = pickLessonSlug({
      taken: [...taken, ...assigned.map((entry) => entry.slug)],
      title: lesson.title,
    });

    assigned.push({ lesson, slug });
    return assigned;
  }, []);
}

/**
 * `createLibraryLesson` for lessons identity resolution just said to generate, all in one home
 * chapter, such as a chapter outline's: the chapter and the slugs taken there are read once, each
 * lesson gets its own free slug, and each is inserted without looking its key up again. A lesson
 * whose key or slug another request took in the meantime goes through `createLibraryLesson`,
 * which returns the row that won or retries with a free slug. Returns the lessons in order.
 *
 * A workflow bridge, like `createLibraryLesson`.
 */
export async function createHomeChapterLessons({
  homeChapterId,
  lessons,
  ownerId,
}: {
  homeChapterId: string | null;
  lessons: readonly Omit<CreateLibraryLessonInput, "homeChapterId" | "ownerId">[];
  ownerId: string | null;
}): Promise<CreatedLesson[]> {
  const inputs = lessons.map((lesson) => ({ ...lesson, homeChapterId, ownerId }));

  if (inputs.length === 0) {
    return [];
  }

  inputs.forEach((input) => assertIdentityKeyScope({ key: input.identityKey, ownerId }));

  const [, taken] = await Promise.all([
    assertLessonHome({ homeChapterId, ownerId }),
    listHomeSlugs(homeChapterId),
  ]);

  return Promise.all(
    assignSlugs({ lessons: inputs, taken }).map(async ({ lesson, slug }) => {
      const inserted = await safeAsync(() => insertLesson({ input: lesson, slug }));

      if (!inserted.error) {
        return { created: true, lesson: inserted.data };
      }

      if (!isPrismaUniqueConstraintError(inserted.error)) {
        throw inserted.error;
      }

      return createLibraryLesson(lesson);
    }),
  );
}
