import "server-only";
import { type CourseLevel, type Lesson, prisma } from "@zoonk/db";
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

export type CreateLibraryLessonInput = {
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

async function findLessonByIdentity({
  identityKey,
  language,
}: Pick<CreateLibraryLessonInput, "identityKey" | "language">) {
  return prisma.lesson.findUnique({
    omit: lessonOmit,
    where: { languageIdentity: { identityKey, language } },
  });
}

async function assertLessonHome(input: CreateLibraryLessonInput): Promise<void> {
  if (!input.homeChapterId) {
    return;
  }

  const chapter = await prisma.chapter.findUniqueOrThrow({ where: { id: input.homeChapterId } });

  assertHomeVisibility({ child: toLibraryVisibility(input.ownerId), home: chapter });
}

async function getAvailableLessonSlug(input: CreateLibraryLessonInput): Promise<string> {
  const taken = input.homeChapterId
    ? await prisma.lesson.findMany({
        select: { slug: true },
        where: { homeChapterId: input.homeChapterId },
      })
    : [];

  return pickAvailableSlug({
    base: toSlug(input.title) || "lesson",
    taken: taken.map((lesson) => lesson.slug),
  });
}

async function insertLesson(input: CreateLibraryLessonInput) {
  return prisma.lesson.create({
    data: {
      description: input.description,
      estimatedMinutes: input.estimatedMinutes,
      homeChapterId: input.homeChapterId,
      identityKey: input.identityKey,
      language: input.language,
      level: input.level,
      normalizedTitle: normalizeString(input.title),
      skills: { create: [...new Set(input.skillIds)].map((skillId) => ({ skillId })) },
      slug: await getAvailableLessonSlug(input),
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
export async function createLibraryLesson(
  input: CreateLibraryLessonInput,
): Promise<{ created: boolean; lesson: Omit<Lesson, keyof typeof lessonOmit> }> {
  assertIdentityKeyScope({ key: input.identityKey, ownerId: input.ownerId });
  await assertLessonHome(input);

  const { created, row } = await createOrFindByIdentity({
    create: () => insertLesson(input),
    findExisting: () => findLessonByIdentity(input),
  });

  return { created, lesson: row };
}
