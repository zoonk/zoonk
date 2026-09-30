import "server-only";
import { type Chapter, type CourseLevel, prisma } from "@zoonk/db";
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

export type CreateLibraryChapterInput = {
  /** The key `resolveLibraryIdentity` returned with its `generate` outcome. */
  identityKey: string;
  language: string;
  targetLanguage: string | null;
  level: CourseLevel;
  title: string;
  description: string;
  objectives: string[];
  /** The course whose outline first needed this chapter; it gives the chapter its URL. */
  homeCourseId: string | null;
  /** Set for a private course's chapter, which only its owner ever sees. */
  ownerId: string | null;
  provenance: LibraryProvenance;
};

async function findChapterByIdentity({
  identityKey,
  language,
}: Pick<CreateLibraryChapterInput, "identityKey" | "language">): Promise<Chapter | null> {
  return prisma.chapter.findUnique({ where: { languageIdentity: { identityKey, language } } });
}

async function assertChapterHome(input: CreateLibraryChapterInput): Promise<void> {
  if (!input.homeCourseId) {
    return;
  }

  const course = await prisma.course.findUniqueOrThrow({ where: { id: input.homeCourseId } });

  assertHomeVisibility({
    child: toLibraryVisibility(input.ownerId),
    home: { ownerId: course.userId, visibility: course.visibility },
  });
}

async function getAvailableChapterSlug(input: CreateLibraryChapterInput): Promise<string> {
  const taken = input.homeCourseId
    ? await prisma.chapter.findMany({
        select: { slug: true },
        where: { homeCourseId: input.homeCourseId },
      })
    : [];

  return pickAvailableSlug({
    base: toSlug(input.title) || "chapter",
    taken: taken.map((chapter) => chapter.slug),
  });
}

async function insertChapter(input: CreateLibraryChapterInput): Promise<Chapter> {
  return prisma.chapter.create({
    data: {
      description: input.description,
      homeCourseId: input.homeCourseId,
      identityKey: input.identityKey,
      language: input.language,
      level: input.level,
      normalizedTitle: normalizeString(input.title),
      objectives: input.objectives,
      slug: await getAvailableChapterSlug(input),
      targetLanguage: input.targetLanguage,
      title: input.title,
      ...toLibraryVisibility(input.ownerId),
      ...toProvenanceData(input.provenance),
    },
  });
}

/**
 * Creates a chapter outline row for a generation workflow, or returns the one
 * a concurrent request created under the same identity. Only the caller that
 * gets `created: true` should write this chapter's lesson outline.
 *
 * This is a workflow bridge, not an app authorization boundary: it accepts an
 * owner id only because the public core boundary that started the workflow
 * derived it from the authenticated session.
 */
export async function createLibraryChapter(
  input: CreateLibraryChapterInput,
): Promise<{ chapter: Chapter; created: boolean }> {
  assertIdentityKeyScope({ key: input.identityKey, ownerId: input.ownerId });
  await assertChapterHome(input);

  const { created, row } = await createOrFindByIdentity({
    create: () => insertChapter(input),
    findExisting: () => findChapterByIdentity(input),
  });

  return { chapter: row, created };
}
