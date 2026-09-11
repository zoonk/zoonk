import { type Course, type TransactionClient, sql } from "@zoonk/db";
import { getContentLocale } from "@zoonk/utils/locale";
import { getCompatibleCourseFormats } from "../course-prompt-generation";

/**
 * Family membership can merge while another language request is being saved.
 * Serialize only this short bookkeeping transaction, never model calls or
 * generation, so requests continue following their source course after merges.
 */
export async function lockCourseFamilies(transaction: TransactionClient): Promise<void> {
  await transaction.$queryRaw(sql`SELECT pg_advisory_xact_lock(92741, 1)::text`);
}

export function haveCompatibleEditionIdentity({
  source,
  course,
}: {
  source: Course;
  course: Course;
}): boolean {
  return (
    source.organizationId === course.organizationId &&
    getCompatibleCourseFormats(source.format).includes(course.format) &&
    source.targetLanguage === course.targetLanguage
  );
}

export async function ensureCourseFamily({
  course,
  transaction,
}: {
  course: Course;
  transaction: TransactionClient;
}): Promise<string> {
  if (course.familyId) {
    return course.familyId;
  }

  const family = await transaction.courseFamily.create({ data: {} });
  await transaction.course.update({ data: { familyId: family.id }, where: { id: course.id } });
  return family.id;
}

/**
 * Old editions may already contain duplicate courses in one language. Preserve
 * their IDs and progress, preferring usable content before an unfinished row.
 */
export function chooseCourseEdition(courses: Course[]): Course | null {
  return (
    courses.find((course) => course.generationStatus === "completed") ??
    courses.find((course) => course.generationStatus === "running") ??
    courses[0] ??
    null
  );
}

export async function findFamilyCourse({
  familyId,
  language,
  transaction,
}: {
  familyId: string;
  language: string;
  transaction: TransactionClient;
}): Promise<Course | null> {
  const courses = await transaction.course.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { familyId, isPublished: true },
  });

  return chooseCourseEdition(
    courses.filter((course) => getContentLocale(course.language) === language),
  );
}

/**
 * Membership is evidence from the existing identity resolver, not a translated
 * slug guess. Keep request provenance on its source course so no pending request
 * is lost when two already-populated families meet.
 */
export async function linkCourseEditions({
  courseId,
  language,
  sourceCourseId,
  transaction,
}: {
  courseId: string;
  language: string;
  sourceCourseId: string;
  transaction: TransactionClient;
}): Promise<void> {
  const [source, course] = await Promise.all([
    transaction.course.findUniqueOrThrow({ where: { id: sourceCourseId } }),
    transaction.course.findUniqueOrThrow({ where: { id: courseId } }),
  ]);

  if (
    !source.isPublished ||
    !course.isPublished ||
    getContentLocale(course.language) !== language ||
    !haveCompatibleEditionIdentity({ course, source })
  ) {
    throw new Error("Course edition does not match its source course");
  }

  if (source.id === course.id) {
    return;
  }

  await mergeCourseFamilies({ course, source, transaction });
}

export async function mergeCourseFamilies({
  course,
  source,
  transaction,
}: {
  course: Course;
  source: Course;
  transaction: TransactionClient;
}): Promise<void> {
  if (
    !source.isPublished ||
    !course.isPublished ||
    !haveCompatibleEditionIdentity({ course, source })
  ) {
    throw new Error("Course families contain incompatible editions");
  }

  const sourceFamilyId = await ensureCourseFamily({ course: source, transaction });

  const familyIds = [
    ...new Set([sourceFamilyId, course.familyId].filter((id): id is string => Boolean(id))),
  ].toSorted();

  const familyId = familyIds[0] ?? sourceFamilyId;
  const members = await transaction.course.findMany({ where: { familyId: { in: familyIds } } });

  if (members.some((member) => !haveCompatibleEditionIdentity({ course: member, source }))) {
    throw new Error("Course families contain incompatible editions");
  }

  await transaction.course.updateMany({
    data: { familyId },
    where: { OR: [{ familyId: { in: familyIds } }, { id: course.id }] },
  });

  await transaction.courseFamily.deleteMany({
    where: { id: { in: familyIds.filter((id) => id !== familyId) } },
  });
}
