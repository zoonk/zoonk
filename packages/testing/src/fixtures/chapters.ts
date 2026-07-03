import { randomUUID } from "node:crypto";
import { type Chapter, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

const MAX_POSITION_RETRIES = 3;

/**
 * Keeps fixture defaults compatible with the per-course chapter order
 * invariant. Most tests only need "a chapter" and should not all collide at
 * position zero when they create multiple chapters for the same course.
 */
async function getChapterPosition(attrs?: Partial<Chapter>): Promise<number> {
  if (attrs?.position !== undefined) {
    return attrs.position;
  }

  if (!attrs?.courseId) {
    return 0;
  }

  const latestChapter = await prisma.chapter.findFirst({
    orderBy: { position: "desc" },
    where: { courseId: attrs.courseId },
  });

  return (latestChapter?.position ?? -1) + 1;
}

/**
 * Builds the database payload for a chapter fixture while preserving explicit
 * overrides. Position is resolved before spreading overrides so tests that
 * assert a specific order can still pass that exact value.
 */
async function chapterAttrs(
  attrs?: Partial<Chapter>,
): Promise<Omit<Chapter, "id" | "createdAt" | "updatedAt">> {
  const title = attrs?.title ?? "Test Chapter";
  const normalizedTitle = attrs?.normalizedTitle ?? normalizeString(title);
  const position = await getChapterPosition(attrs);

  return {
    courseId: "",
    description: "Test chapter description",
    generationRunId: null,
    generationStatus: "completed",
    imageUrl: null,
    isLocked: false,
    isPublished: false,
    language: "en",
    normalizedTitle,
    organizationId: null,
    position,
    slug: `test-chapter-${randomUUID()}`,
    title,
    ...attrs,
  };
}

/**
 * Creates a chapter for tests and retries default-position races. Parallel
 * fixtures for the same course can observe the same latest chapter, so a unique
 * position collision should simply recompute the next slot.
 */
async function createChapterFixture({
  attempt = 0,
  attrs,
}: { attempt?: number; attrs?: Partial<Chapter> } = {}): Promise<Chapter> {
  try {
    const chapter = await prisma.chapter.create({ data: await chapterAttrs(attrs) });
    return chapter;
  } catch (error) {
    if (attrs?.position !== undefined || !isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    if (attempt >= MAX_POSITION_RETRIES) {
      throw error;
    }

    return createChapterFixture({ attempt: attempt + 1, attrs });
  }
}

/**
 * Preserves the simple fixture API used across tests while delegating collision
 * handling to a private helper that can carry retry state.
 */
export async function chapterFixture(attrs?: Partial<Chapter>): Promise<Chapter> {
  return createChapterFixture({ attrs });
}
