import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type CourseIdentityCandidate,
  type CourseIdentityProposedCourse,
  resolveCourseIdentity,
} from "@zoonk/ai/tasks/courses/identity";
import { generateCourseIdentitySearchQueries } from "@zoonk/ai/tasks/courses/identity-search";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseGetPayload, getAiGenerationCourseWhere, prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { courseContentInclude } from "../_internal/existing-course-content";
import { type GeneratableCourseStartRequest } from "./get-course-start-request-step";

const IDENTITY_SEARCH_STEP = "generateCourseIdentitySearchQueries";
const IDENTITY_CLASSIFICATION_STEP = "resolveCourseIdentity";
const MIN_SEARCH_TEXT_LENGTH = 3;

export type ExistingCourse = CourseGetPayload<{ include: typeof courseContentInclude }>;

type CourseWhereInput = NonNullable<Parameters<typeof getAiGenerationCourseWhere>[0]>;
type CourseIdentityStream = ReturnType<typeof createStepStream<CourseWorkflowStepName>>;

/**
 * Keeps optional query clauses type-safe after the conditional array pattern.
 * The resolver builds many small Prisma clauses from title, prompt, target
 * language, and AI-generated search phrases, and falsey clauses mean "this
 * signal is not available for the current request."
 */
function isCourseWhereInput(value: CourseWhereInput | false | null): value is CourseWhereInput {
  return Boolean(value);
}

/**
 * Prevents tiny standalone AI search terms from turning candidate retrieval
 * into a broad substring scan. Short acronyms such as "AI" or "IA" can appear
 * inside many unrelated normalized titles, so they add much more noise than
 * recall when used with `contains`.
 */
function isSearchTextLongEnough(text: string): boolean {
  return normalizeString(text).length >= MIN_SEARCH_TEXT_LENGTH;
}

/**
 * Converts a course row into the smaller identity shape the model is allowed to
 * inspect. The classifier only needs catalog identity fields, not full course
 * content or user/progress data.
 */
function toIdentityCandidate(course: ExistingCourse): CourseIdentityCandidate {
  return {
    description: course.description,
    language: course.language,
    slug: course.slug,
    targetLanguage: course.targetLanguage,
    title: course.title,
  };
}

/**
 * Converts a course start request into the model input shape. Keeping this mapper
 * local to the workflow prevents the AI package from depending on Prisma types.
 */
function toIdentityRequest(request: GeneratableCourseStartRequest): CourseIdentityProposedCourse {
  return {
    description: null,
    language: request.language,
    targetLanguage: request.targetLanguage,
    title: request.canonicalTitle,
  };
}

/**
 * Builds Prisma clauses for one candidate search phrase. The search-query AI
 * task is responsible for returning useful atomic terms, so this intentionally
 * treats each returned query as one search unit instead of splitting it into
 * loose words that would need a global stop-word list.
 */
function getSearchTextWhereClauses({
  language,
  text,
}: {
  language: string;
  text: string;
}): CourseWhereInput[] {
  if (!isSearchTextLongEnough(text)) {
    return [];
  }

  const normalizedText = normalizeString(text);
  const normalizedSlug = toSlug(text);
  const suffixedSlug = getCourseSlugForTitle({ language, title: text });

  const clauses: (CourseWhereInput | null)[] = [
    normalizedText ? { normalizedTitle: normalizedText } : null,
    normalizedText ? { normalizedTitle: { contains: normalizedText } } : null,
    normalizedSlug ? { slug: suffixedSlug } : null,
  ];

  return clauses.filter((clause): clause is CourseWhereInput => isCourseWhereInput(clause));
}

/**
 * Creates the full candidate search predicate for the proposed course and any
 * AI-generated aliases. Target-language matching is deterministic because
 * Zoonk intentionally has one course per learned language.
 */
function getCandidateWhereClauses({
  searchTexts,
  request,
}: {
  searchTexts: string[];
  request: GeneratableCourseStartRequest;
}): CourseWhereInput[] {
  const clauses: (CourseWhereInput | null)[] = [
    request.targetLanguage ? { targetLanguage: request.targetLanguage } : null,
    ...searchTexts.flatMap((text) =>
      getSearchTextWhereClauses({ language: request.language, text }),
    ),
  ];

  return clauses.filter((clause): clause is CourseWhereInput => isCourseWhereInput(clause));
}

/**
 * Removes duplicate course rows while preserving the database order. The same
 * course can match by slug, normalized title, and multiple AI search phrases.
 */
function uniqueCourses(courses: ExistingCourse[]): ExistingCourse[] {
  return [...new Map(courses.map((course) => [course.id, course])).values()];
}

/**
 * Loads public AI-catalog courses that might be the same identity as the
 * request. This step intentionally favors recall; the AI classifier makes
 * the conservative final decision.
 */
async function findCandidateCourses({
  request,
  searchTexts,
}: {
  request: GeneratableCourseStartRequest;
  searchTexts: string[];
}): Promise<ExistingCourse[]> {
  const whereClauses = getCandidateWhereClauses({ request, searchTexts });

  if (whereClauses.length === 0) {
    return [];
  }

  return prisma.course.findMany({
    include: courseContentInclude,
    where: getAiGenerationCourseWhere({ OR: whereClauses, language: request.language }),
  });
}

/**
 * Finds deterministic matches that do not need model judgment. Exact slug,
 * exact normalized title, and target-language identity are hard product rules,
 * so asking the model would only add latency and possible drift.
 */
function getDirectMatch({
  candidates,
  request,
}: {
  candidates: ExistingCourse[];
  request: GeneratableCourseStartRequest;
}): ExistingCourse | null {
  const slug = getCourseSlugForTitle({ language: request.language, title: request.canonicalTitle });
  const normalizedTitle = normalizeString(request.canonicalTitle);

  return (
    candidates.find((course) => course.slug === slug) ??
    candidates.find((course) => course.normalizedTitle === normalizedTitle) ??
    candidates.find(
      (course) =>
        Boolean(request.targetLanguage) && course.targetLanguage === request.targetLanguage,
    ) ??
    null
  );
}

/**
 * Loads the already-linked course for repeat attempts. This is the cache that
 * keeps repeat attempts cheap: once a request is resolved, future generation
 * requests use the saved course id directly.
 */
async function getCachedCourse(courseId: string | null): Promise<ExistingCourse | null> {
  if (!courseId) {
    return null;
  }

  return prisma.course.findFirst({
    include: courseContentInclude,
    where: getAiGenerationCourseWhere({ id: courseId }),
  });
}

/**
 * Persists a positive identity resolution on the request so the same title
 * does not need semantic classification again.
 */
async function linkRequestToCourse({
  courseId,
  requestId,
}: {
  courseId: string;
  requestId: string;
}): Promise<void> {
  await prisma.courseStartRequest.update({ data: { courseId }, where: { id: requestId } });
}

/**
 * Returns the candidate chosen by the classifier. If the model returns a slug
 * outside the supplied candidate set, ignore it rather than risking a wrong
 * redirect or a cross-catalog link.
 */
function getAiSelectedCourse({
  candidates,
  courseSlug,
}: {
  candidates: ExistingCourse[];
  courseSlug: string | null;
}): ExistingCourse | null {
  if (!courseSlug) {
    return null;
  }

  return candidates.find((course) => course.slug === courseSlug) ?? null;
}

/**
 * Marks both identity AI phases as completed when a cached or deterministic
 * match made the model calls unnecessary. The progress UI still needs those
 * phases to finish so later course-generation steps can advance normally.
 */
async function streamSkippedIdentityAiSteps(stream: CourseIdentityStream): Promise<void> {
  await stream.status({ status: "completed", step: IDENTITY_SEARCH_STEP });
  await stream.status({ status: "completed", step: IDENTITY_CLASSIFICATION_STEP });
}

/**
 * Marks the classifier phase as completed when candidate retrieval found
 * nothing worth classifying. This represents a skipped AI call, not a failed
 * identity check.
 */
async function streamSkippedIdentityClassification(stream: CourseIdentityStream): Promise<void> {
  await stream.status({ status: "completed", step: IDENTITY_CLASSIFICATION_STEP });
}

/**
 * Runs the recall-oriented AI query generator with its own stream events so the
 * learner can see that duplicate-course search is doing model work.
 */
async function generateSearchQueriesWithStatus({
  request,
  stream,
}: {
  request: GeneratableCourseStartRequest;
  stream: CourseIdentityStream;
}): ReturnType<typeof generateCourseIdentitySearchQueries> {
  await stream.status({ status: "started", step: IDENTITY_SEARCH_STEP });

  const search = await generateCourseIdentitySearchQueries({
    proposedCourse: toIdentityRequest(request),
  });

  await stream.status({ status: "completed", step: IDENTITY_SEARCH_STEP });

  return search;
}

/**
 * Runs the conservative duplicate classifier with its own stream events. This
 * is separate from search-query generation because it is a second AI call with
 * different latency and thinking copy.
 */
async function resolveIdentityWithStatus({
  candidates,
  request,
  stream,
}: {
  candidates: ExistingCourse[];
  request: GeneratableCourseStartRequest;
  stream: CourseIdentityStream;
}): ReturnType<typeof resolveCourseIdentity> {
  await stream.status({ status: "started", step: IDENTITY_CLASSIFICATION_STEP });

  const identity = await resolveCourseIdentity({
    candidates: candidates.map((course) => toIdentityCandidate(course)),
    proposedCourse: toIdentityRequest(request),
  });

  await stream.status({ status: "completed", step: IDENTITY_CLASSIFICATION_STEP });

  return identity;
}

/**
 * Resolves whether the course start request should use an existing AI-catalog
 * course. Deterministic links run first, AI search expands candidate recall,
 * and the final classifier only chooses among explicit database rows.
 */
export async function resolveCourseIdentityStep(
  request: GeneratableCourseStartRequest,
): Promise<ExistingCourse | null> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  const cachedCourse = await getCachedCourse(request.courseId);

  if (cachedCourse) {
    await streamSkippedIdentityAiSteps(stream);
    return cachedCourse;
  }

  const deterministicCandidates = await findCandidateCourses({
    request,
    searchTexts: [request.canonicalTitle, request.prompt],
  });

  const directMatch = getDirectMatch({ candidates: deterministicCandidates, request });

  if (directMatch) {
    await linkRequestToCourse({ courseId: directMatch.id, requestId: request.id });
    await streamSkippedIdentityAiSteps(stream);
    return directMatch;
  }

  const search = await generateSearchQueriesWithStatus({ request, stream });

  const aiCandidates = await findCandidateCourses({ request, searchTexts: search.data.queries });

  const candidates = uniqueCourses([...deterministicCandidates, ...aiCandidates]);

  if (candidates.length === 0) {
    await streamSkippedIdentityClassification(stream);
    return null;
  }

  const identity = await resolveIdentityWithStatus({ candidates, request, stream });

  const selectedCourse =
    identity.data.decision === "useExisting"
      ? getAiSelectedCourse({ candidates, courseSlug: identity.data.courseSlug })
      : null;

  if (selectedCourse) {
    await linkRequestToCourse({ courseId: selectedCourse.id, requestId: request.id });
  }

  return selectedCourse;
}
