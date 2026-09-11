import "server-only";
import { type Course, type TransactionClient, prisma } from "@zoonk/db";
import { getContentLocale } from "@zoonk/utils/locale";
import {
  chooseCourseEdition,
  ensureCourseFamily,
  findFamilyCourse,
  haveCompatibleEditionIdentity,
  linkCourseEditions,
  lockCourseFamilies,
  mergeCourseFamilies,
} from "./_utils/edition-family";
import { getCompatibleCourseFormats } from "./course-prompt-generation";

export { getCourseEditionPrompt } from "./_utils/edition-prompt";

/** Workflow provenance always comes from persisted requests, never client input. */
async function getEditionRequests({
  coursePromptId,
  transaction,
}: {
  coursePromptId: string;
  transaction: TransactionClient;
}) {
  const requests = await transaction.courseEditionRequest.findMany({
    include: { coursePrompt: true, sourceCourse: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { coursePromptId },
  });

  const publishedRequests = requests.filter((request) => request.sourceCourse.isPublished);

  if (requests.length > 0 && publishedRequests.length === 0) {
    throw new Error("Course edition request has no published source course");
  }

  for (const request of publishedRequests) {
    const { coursePrompt, sourceCourse } = request;

    if (
      getContentLocale(coursePrompt.language) !== request.language ||
      !coursePrompt.courseFormat ||
      !getCompatibleCourseFormats(sourceCourse.format).includes(coursePrompt.courseFormat) ||
      sourceCourse.targetLanguage !== coursePrompt.targetLanguage ||
      (sourceCourse.format === "language" &&
        getContentLocale(sourceCourse.targetLanguage ?? "") === request.language)
    ) {
      throw new Error("Course edition request does not match its source course");
    }
  }

  return publishedRequests;
}

/**
 * Called inside initialization's transaction. The lock remains held until the
 * row is saved, preventing different translated slugs from creating two new
 * editions after independently discovered families have merged.
 */
export async function getCourseEditionForPrompt({
  coursePromptId,
  transaction,
}: {
  coursePromptId: string;
  transaction: TransactionClient;
}): Promise<{ familyId: string; course: Course | null } | null> {
  await lockCourseFamilies(transaction);
  const requests = await getEditionRequests({ coursePromptId, transaction });
  const first = requests[0];

  if (!first) {
    return null;
  }

  for (const request of requests.slice(1)) {
    // Each merge changes family IDs, so later merges must read the updated rows.
    // eslint-disable-next-line no-await-in-loop
    const [source, course] = await Promise.all([
      transaction.course.findUniqueOrThrow({ where: { id: first.sourceCourseId } }),
      transaction.course.findUniqueOrThrow({ where: { id: request.sourceCourseId } }),
    ]);

    // eslint-disable-next-line no-await-in-loop -- Family mutations must be sequential.
    await mergeCourseFamilies({ course, source, transaction });
  }

  const source = await transaction.course.findUniqueOrThrow({
    where: { id: first.sourceCourseId },
  });

  const familyId = await ensureCourseFamily({ course: source, transaction });
  const course = await findFamilyCourse({ familyId, language: first.language, transaction });

  if (course && !haveCompatibleEditionIdentity({ course, source })) {
    throw new Error("Course edition does not match its source course");
  }

  return { course, familyId };
}

/** Checks every source family because a reused prompt can acquire more than one. */
export async function getExistingCourseEditionForPrompt({
  coursePromptId,
}: {
  coursePromptId: string;
}): Promise<Course | null> {
  const requests = await getEditionRequests({ coursePromptId, transaction: prisma });

  const courses = await Promise.all(
    requests.map(async (request) => {
      if (!request.sourceCourse.familyId) {
        return null;
      }

      const course = await findFamilyCourse({
        familyId: request.sourceCourse.familyId,
        language: request.language,
        transaction: prisma,
      });

      if (course && !haveCompatibleEditionIdentity({ course, source: request.sourceCourse })) {
        throw new Error("Course edition does not match its source course");
      }

      return course;
    }),
  );

  return chooseCourseEdition(courses.filter((course): course is Course => Boolean(course)));
}

/** Attaches every source that reused a prompt, including sources merged mid-run. */
export async function linkCourseToEditionRequests({
  courseId,
  coursePromptId,
}: {
  courseId: string;
  coursePromptId: string;
}): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await lockCourseFamilies(transaction);
    const requests = await getEditionRequests({ coursePromptId, transaction });

    for (const request of requests) {
      // eslint-disable-next-line no-await-in-loop -- Each attachment can merge the next source's family.
      await linkCourseEditions({
        courseId,
        language: request.language,
        sourceCourseId: request.sourceCourseId,
        transaction,
      });
    }
  });
}
