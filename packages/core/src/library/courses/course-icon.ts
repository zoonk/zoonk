import "server-only";
import { type CourseIconParams, generateCourseIcon } from "@zoonk/ai/tasks/v2/courses/icon";
import { prisma } from "@zoonk/db";
import { logInfo } from "@zoonk/utils/logger";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag } from "../../cache/tags";
import { isNearSolidImage } from "../../images/image-quality";
import { optimizeImage } from "../../images/optimize-image";
import { uploadImage } from "../../images/upload-image";
import { type LibraryProvenance } from "../_utils/library-rows";

type IconAnalytics = CourseIconParams["analytics"];

/** A blank icon is drawn once more; if that fails too, the course keeps the generic icon. */
const ICON_ATTEMPTS = 2;

type IconCourse = { description: string | null; slug: string; title: string };

type DrawnIcon = { image: Uint8Array; provenance: LibraryProvenance };

/** Draws icons until one isn't a blank frame, or null after the last attempt. */
async function drawIcon({
  analytics,
  attempts,
  course,
}: {
  analytics?: IconAnalytics;
  attempts: number;
  course: IconCourse;
}): Promise<DrawnIcon | null> {
  if (attempts <= 0) {
    return null;
  }

  const { data, provenance } = await generateCourseIcon({
    analytics,
    description: course.description,
    title: course.title,
  });

  const image = data.image.uint8Array;
  const { data: isBlank, error } = await isNearSolidImage({ image: Buffer.from(image) });

  if (error) {
    throw error;
  }

  if (!isBlank) {
    return { image, provenance };
  }

  logInfo("[images] Course icon is a blank frame", { title: course.title });
  return drawIcon({ analytics, attempts: attempts - 1, course });
}

async function uploadIcon({ image, slug }: { image: Uint8Array; slug: string }): Promise<string> {
  const { data: optimized, error: optimizeError } = await optimizeImage({
    image: Buffer.from(image),
  });

  if (optimizeError) {
    throw optimizeError;
  }

  const upload = await uploadImage({ fileName: `library/courses/${slug}.webp`, image: optimized });

  if (upload.error) {
    throw upload.error;
  }

  return upload.data;
}

/** The drawing run of the icon that was kept, not of the blank frames drawn before it. */
function toIconProvenanceData(provenance: LibraryProvenance) {
  return {
    iconGeneratedAt: new Date(provenance.generatedAt),
    iconModel: provenance.model,
    iconPromptVersion: provenance.promptVersion,
    iconRunId: provenance.runId,
  };
}

/**
 * Gives a shared course its icon in the style courses always had: one matte 3D object on white,
 * like an app icon, shown on course cards and search. A course that has one keeps it, private
 * courses are never listed, and language courses show their flag instead. Returns the icon's URL,
 * or null when the course goes without one.
 *
 * This is a workflow bridge, not an app authorization boundary.
 */
export async function createCourseIcon({
  analytics,
  courseId,
}: {
  analytics?: IconAnalytics;
  courseId: string;
}): Promise<string | null> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });

  if (!course || course.imageUrl || course.visibility !== "public" || course.targetLanguage) {
    return course?.imageUrl ?? null;
  }

  const icon = await drawIcon({ analytics, attempts: ICON_ATTEMPTS, course });

  if (!icon) {
    return null;
  }

  const url = await uploadIcon({ image: icon.image, slug: course.slug });

  await prisma.course.updateMany({
    data: { imageUrl: url, ...toIconProvenanceData(icon.provenance) },
    where: { id: courseId, imageUrl: null },
  });

  revalidateCacheTags([getCourseCacheTag(courseId), COURSE_LIST_CACHE_TAG]);

  return url;
}
