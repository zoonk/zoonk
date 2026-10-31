import "server-only";
import { type Chapter, type CourseLevel, prisma } from "@zoonk/db";
import { assertIdentityKeyScope } from "@zoonk/utils/identity-key";
import { normalizeString, pickAvailableSlug, toSlug } from "@zoonk/utils/string";
import {
  type LibraryProvenance,
  createOrFindByIdentity,
  toLibraryVisibility,
  toProvenanceData,
} from "../_utils/library-rows";
import { assertHomeVisibility } from "../_utils/placement-visibility";

export type CreateLibraryChapterInput = {
  identityKey: string;
  language: string;
  targetLanguage: string | null;
  level: CourseLevel;
  title: string;
  description: string;
  objectives: string[];
  homeCourseId: string | null;
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

/** Internal workflow bridge: derive the owner from the authenticated boundary; only `created: true` owns outline generation. */
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
