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
import { normalizeString, pickAvailableSlug, toSlug } from "@zoonk/utils/string";
import {
  type LibraryProvenance,
  createOrFindByIdentity,
  toLibraryVisibility,
  toProvenanceData,
} from "../_utils/library-rows";
import { assertHomeVisibility } from "../_utils/placement-visibility";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";

export type NewLessonDetails = Partial<
  Pick<LessonUncheckedCreateInput, "canDo" | "spec" | "specRunId" | "specStatus">
>;

export type CreateLibraryLessonInput = NewLessonDetails & {
  identityKey: string;
  language: string;
  targetLanguage: string | null;
  level: CourseLevel;
  title: string;
  description: string;
  estimatedMinutes: number;
  skillIds: string[];
  homeChapterId: string | null;
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
  return writePlanInputs(async (tx) => {
    await lockPlanSourceWrite(tx, { skillIds: input.skillIds });

    return tx.lesson.create({
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
  });
}

/** Internal workflow bridge: derive the owner from the authenticated public boundary. */
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

/** Internal workflow bridge with the same trust requirements as `createLibraryLesson`; results preserve input order. */
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
