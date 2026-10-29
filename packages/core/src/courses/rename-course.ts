import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCourseContent } from "../cache/revalidate-course-content";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag, getCourseRouteCacheTag } from "../cache/tags";
import { getAdminAccess } from "../users/get-admin-access";

type RenameCourseResult =
  | { slug: string; status: "renamed"; title: string }
  | { status: "forbidden" | "invalidSlug" | "notFound" | "slugTaken" | "unauthorized" };

/** Preserve unchanged stored slugs byte for byte, including values predating the current rules. */
function getUpdatedSlug({ currentSlug, submitted }: { currentSlug: string; submitted: string }) {
  return submitted === currentSlug ? currentSlug : toSlug(submitted);
}

/** Requires an admin session and expires both the old and new route, including cached misses. */
export async function renameCourseForAdmin({
  courseId,
  slug: submittedSlug,
  title,
}: {
  courseId: string;
  slug: string;
  title: string;
}): Promise<RenameCourseResult> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  const course = isUuid(courseId)
    ? await prisma.course.findUnique({
        select: { organization: { select: { slug: true } }, slug: true },
        where: { id: courseId },
      })
    : null;

  if (!course) {
    return { status: "notFound" };
  }

  const slug = getUpdatedSlug({ currentSlug: course.slug, submitted: submittedSlug });

  if (!slug) {
    return { status: "invalidSlug" };
  }

  const { error } = await safeAsync(() =>
    prisma.course.update({
      data: { normalizedTitle: normalizeString(title), slug, title },
      where: { id: courseId },
    }),
  );

  if (isPrismaUniqueConstraintError(error)) {
    return { status: "slugTaken" };
  }

  if (error) {
    throw error;
  }

  const brandSlug = course.organization?.slug;

  await revalidateCourseContent([
    getCourseCacheTag(courseId),
    COURSE_LIST_CACHE_TAG,
    ...(brandSlug
      ? [
          getCourseRouteCacheTag({ brandSlug, courseSlug: course.slug }),
          getCourseRouteCacheTag({ brandSlug, courseSlug: slug }),
        ]
      : []),
  ]);

  return { slug, status: "renamed", title };
}
