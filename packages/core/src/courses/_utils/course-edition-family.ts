import { type Course, type TransactionClient } from "@zoonk/db";
import { getContentLocale } from "@zoonk/utils/locale";

type EditionCourse = Pick<
  Course,
  | "country"
  | "familyId"
  | "format"
  | "id"
  | "isPublished"
  | "language"
  | "targetLanguage"
  | "userId"
  | "visibility"
>;

type CourseEditionPair = { course: EditionCourse; edition: EditionCourse };

export function courseContentLanguage(language: string): string {
  return getContentLocale(language) ?? language;
}

export async function readCourseEditionPair(
  db: TransactionClient,
  { courseId, editionId }: { courseId: string; editionId: string },
): Promise<CourseEditionPair | null> {
  const courses = await db.course.findMany({
    omit: { landingPage: true },
    where: { id: { in: [courseId, editionId] } },
  });

  const course = courses.find((row) => row.id === courseId);
  const edition = courses.find((row) => row.id === editionId);

  return course && edition ? { course, edition } : null;
}

export async function getCourseEditionProblem(
  db: TransactionClient,
  { course, edition }: CourseEditionPair,
): Promise<string | null> {
  if (
    [course, edition].some((row) => !row.isPublished || row.visibility !== "public" || row.userId)
  ) {
    return "Both courses must be public, published and ownerless.";
  }

  if (courseContentLanguage(course.language) === courseContentLanguage(edition.language)) {
    return "Editions must have different content languages.";
  }

  if (course.targetLanguage !== edition.targetLanguage || course.format !== edition.format) {
    return "Editions must have the same target language and format.";
  }

  if (course.familyId && edition.familyId && course.familyId !== edition.familyId) {
    return "The courses already belong to different families.";
  }

  return (await hasConflictingMember(db, { course, edition }))
    ? "The family already has an edition in this language."
    : null;
}

async function hasConflictingMember(tx: TransactionClient, { course, edition }: CourseEditionPair) {
  const familyId = course.familyId ?? edition.familyId;

  if (!familyId || (course.familyId && edition.familyId)) {
    return false;
  }

  await tx.$queryRaw`SELECT id FROM course_families WHERE id = ${familyId}::uuid FOR NO KEY UPDATE`;

  const languagesToJoin = new Set(
    [course, edition]
      .filter((row) => !row.familyId)
      .map((row) => courseContentLanguage(row.language)),
  );

  const members = await tx.course.findMany({ select: { language: true }, where: { familyId } });

  return members.some((member) => languagesToJoin.has(courseContentLanguage(member.language)));
}

/** The caller holds both course rows and has checked their current memberships. */
export async function joinCourseEditionFamily(
  tx: TransactionClient,
  { course, edition }: CourseEditionPair,
) {
  const existing = course.familyId ?? edition.familyId;
  const family = existing ? { id: existing } : await tx.courseFamily.create({ data: {} });

  await tx.course.updateMany({
    data: { familyId: family.id },
    where: { familyId: null, id: { in: [course.id, edition.id] } },
  });
}
