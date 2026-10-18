import { type Course } from "@zoonk/db";
import { pickAvailableSlug } from "@zoonk/utils/string";
import { type GuestLinkContext } from "./merge-keyed-rows";

type CourseSlug = Pick<Course, "id" | "slug">;

/** Reserve unchanged guest slugs too, so renaming a clash doesn't take another guest course's URL. */
function allocateTransfer({
  course,
  guestCourses,
  taken,
  transfers,
}: {
  course: CourseSlug;
  guestCourses: CourseSlug[];
  taken: string[];
  transfers: CourseSlug[];
}): CourseSlug {
  return {
    id: course.id,
    slug: pickAvailableSlug({
      base: course.slug,
      taken: [
        ...taken,
        ...guestCourses.filter((row) => row.id !== course.id).map((row) => row.slug),
        ...transfers.map((row) => row.slug),
      ],
    }),
  };
}

/**
 * Courses keep their IDs so goals, chapters and plans keep referencing them. A destination's
 * existing course keeps its slug; a colliding guest course gets the first free numbered suffix,
 * under the caller's destination home lock. It holds the guest's user-row lock through deletion,
 * so source writers cannot commit another guest-owned course after this snapshot. Do not take
 * the source home lock here: a writer may hold it while waiting for the guest's user row.
 */
export async function movePrivateCourses({ guestUserId, transaction, userId }: GuestLinkContext) {
  const courses = await transaction.course.findMany({
    omit: { landingPage: true },
    orderBy: { id: "asc" },
    where: { userId: guestUserId },
  });

  if (courses.length === 0) {
    return;
  }

  const accountCourses = await transaction.course.findMany({
    select: { slug: true },
    where: { userId },
  });

  const taken = accountCourses.map((course) => course.slug);

  const transfers: CourseSlug[] = [];

  for (const course of courses) {
    transfers.push(allocateTransfer({ course, guestCourses: courses, taken, transfers }));
  }

  await Promise.all(
    transfers.map((course) =>
      transaction.course.update({ data: { slug: course.slug, userId }, where: { id: course.id } }),
    ),
  );
}
