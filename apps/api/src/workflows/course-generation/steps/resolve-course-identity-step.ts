import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type CourseIdentityCandidate,
  type CourseIdentitySuggestion,
  resolveCourseIdentity,
} from "@zoonk/ai/tasks/courses/identity";
import { generateCourseIdentitySearchQueries } from "@zoonk/ai/tasks/courses/identity-search";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import {
  type CourseGetPayload,
  type CourseSuggestion,
  getAiGenerationCourseWhere,
  prisma,
} from "@zoonk/db";
import { ensureLocaleSuffix, normalizeString, toSlug } from "@zoonk/utils/string";

const IDENTITY_SEARCH_STEP = "generateCourseIdentitySearchQueries";
const IDENTITY_CLASSIFICATION_STEP = "resolveCourseIdentity";

const courseInclude = { _count: { select: { categories: true, chapters: true } } } as const;

export type ExistingCourse = CourseGetPayload<{ include: typeof courseInclude }>;

type CourseWhereInput = NonNullable<Parameters<typeof getAiGenerationCourseWhere>[0]>;
type CourseIdentityStream = ReturnType<typeof createStepStream<CourseWorkflowStepName>>;

/**
 * Keeps optional query clauses type-safe after the conditional array pattern.
 * The resolver builds many small Prisma clauses from title, slug, target
 * language, and AI-generated search phrases, and falsey clauses mean "this
 * signal is not available for the current suggestion."
 */
function isCourseWhereInput(value: CourseWhereInput | false | null): value is CourseWhereInput {
  return Boolean(value);
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
 * Converts a course suggestion into the model input shape. Keeping this mapper
 * local to the workflow prevents the AI package from depending on Prisma types.
 */
function toIdentitySuggestion(suggestion: CourseSuggestion): CourseIdentitySuggestion {
  return {
    description: suggestion.description,
    language: suggestion.language,
    targetLanguage: suggestion.targetLanguage,
    title: suggestion.title,
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
  const normalizedText = normalizeString(text);
  const normalizedSlug = toSlug(text);
  const suffixedSlug = ensureLocaleSuffix(normalizedSlug, language);

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
  suggestion,
}: {
  searchTexts: string[];
  suggestion: CourseSuggestion;
}): CourseWhereInput[] {
  const clauses: (CourseWhereInput | null)[] = [
    suggestion.targetLanguage ? { targetLanguage: suggestion.targetLanguage } : null,
    ...searchTexts.flatMap((text) =>
      getSearchTextWhereClauses({ language: suggestion.language, text }),
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
 * suggestion. This step intentionally favors recall; the AI classifier makes
 * the conservative final decision.
 */
async function findCandidateCourses({
  searchTexts,
  suggestion,
}: {
  searchTexts: string[];
  suggestion: CourseSuggestion;
}): Promise<ExistingCourse[]> {
  const whereClauses = getCandidateWhereClauses({ searchTexts, suggestion });

  if (whereClauses.length === 0) {
    return [];
  }

  return prisma.course.findMany({
    include: courseInclude,
    where: getAiGenerationCourseWhere({ OR: whereClauses, language: suggestion.language }),
  });
}

/**
 * Finds deterministic matches that do not need model judgment. Exact slug,
 * exact normalized title, and target-language identity are hard product rules,
 * so asking the model would only add latency and possible drift.
 */
function getDirectMatch({
  candidates,
  suggestion,
}: {
  candidates: ExistingCourse[];
  suggestion: CourseSuggestion;
}): ExistingCourse | null {
  const slug = ensureLocaleSuffix(toSlug(suggestion.slug), suggestion.language);
  const normalizedTitle = normalizeString(suggestion.title);

  return (
    candidates.find((course) => course.slug === slug) ??
    candidates.find((course) => course.normalizedTitle === normalizedTitle) ??
    candidates.find(
      (course) =>
        Boolean(suggestion.targetLanguage) && course.targetLanguage === suggestion.targetLanguage,
    ) ??
    null
  );
}

/**
 * Loads the already-linked course for repeat attempts. This is the cache that
 * keeps repeat attempts cheap: once a suggestion is resolved, future generation
 * requests use the saved course id directly.
 */
async function getCachedCourse(courseId: string | null): Promise<ExistingCourse | null> {
  if (!courseId) {
    return null;
  }

  return prisma.course.findFirst({
    include: courseInclude,
    where: getAiGenerationCourseWhere({ id: courseId }),
  });
}

/**
 * Persists a positive identity resolution on the suggestion so the same title
 * does not need semantic classification again.
 */
async function linkSuggestionToCourse({
  courseId,
  suggestionId,
}: {
  courseId: string;
  suggestionId: string;
}): Promise<void> {
  await prisma.courseSuggestion.update({ data: { courseId }, where: { id: suggestionId } });
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
  stream,
  suggestion,
}: {
  stream: CourseIdentityStream;
  suggestion: CourseSuggestion;
}): ReturnType<typeof generateCourseIdentitySearchQueries> {
  await stream.status({ status: "started", step: IDENTITY_SEARCH_STEP });

  const search = await generateCourseIdentitySearchQueries({
    suggestion: toIdentitySuggestion(suggestion),
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
  stream,
  suggestion,
}: {
  candidates: ExistingCourse[];
  stream: CourseIdentityStream;
  suggestion: CourseSuggestion;
}): ReturnType<typeof resolveCourseIdentity> {
  await stream.status({ status: "started", step: IDENTITY_CLASSIFICATION_STEP });

  const identity = await resolveCourseIdentity({
    candidates: candidates.map((course) => toIdentityCandidate(course)),
    suggestion: toIdentitySuggestion(suggestion),
  });

  await stream.status({ status: "completed", step: IDENTITY_CLASSIFICATION_STEP });

  return identity;
}

/**
 * Resolves whether the course suggestion should use an existing AI-catalog
 * course. Deterministic links run first, AI search expands candidate recall,
 * and the final classifier only chooses among explicit database rows.
 */
export async function resolveCourseIdentityStep(
  suggestion: CourseSuggestion,
): Promise<ExistingCourse | null> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  const cachedCourse = await getCachedCourse(suggestion.courseId);

  if (cachedCourse) {
    await streamSkippedIdentityAiSteps(stream);
    return cachedCourse;
  }

  const deterministicCandidates = await findCandidateCourses({
    searchTexts: [suggestion.title, suggestion.slug],
    suggestion,
  });

  const directMatch = getDirectMatch({ candidates: deterministicCandidates, suggestion });

  if (directMatch) {
    await linkSuggestionToCourse({ courseId: directMatch.id, suggestionId: suggestion.id });
    await streamSkippedIdentityAiSteps(stream);
    return directMatch;
  }

  const search = await generateSearchQueriesWithStatus({ stream, suggestion });

  const aiCandidates = await findCandidateCourses({ searchTexts: search.data.queries, suggestion });

  const candidates = uniqueCourses([...deterministicCandidates, ...aiCandidates]);

  if (candidates.length === 0) {
    await streamSkippedIdentityClassification(stream);
    return null;
  }

  const identity = await resolveIdentityWithStatus({ candidates, stream, suggestion });

  const selectedCourse =
    identity.data.decision === "useExisting"
      ? getAiSelectedCourse({ candidates, courseSlug: identity.data.courseSlug })
      : null;

  if (selectedCourse) {
    await linkSuggestionToCourse({ courseId: selectedCourse.id, suggestionId: suggestion.id });
  }

  return selectedCourse;
}
