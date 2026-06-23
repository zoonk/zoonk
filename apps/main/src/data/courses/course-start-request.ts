import "server-only";
import { generateCanonicalCourseTitle } from "@zoonk/ai/tasks/courses/canonical-title";
import {
  type LearnRequestClassification,
  classifyLearnRequest,
} from "@zoonk/ai/tasks/courses/learn-classification";
import {
  type CourseRequestScope,
  routeCourseRequest,
} from "@zoonk/ai/tasks/courses/request-routing";
import { type Course, type CourseStartRequest, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { isUuid } from "@zoonk/utils/uuid";

type CourseStartScope = CourseStartRequest["scope"];
type LearnCourseStartScope = Extract<CourseStartScope, "personalized" | "question" | "topic">;

export type UnsupportedCourseStartScope = Extract<CourseStartScope, "personalized" | "question">;

export type CourseStartRequestResolution =
  | { kind: "generate"; request: Pick<CourseStartRequest, "id" | "canonicalTitle" | "scope"> }
  | { kind: "redirect"; href: "/start/exam" | "/start/speak" }
  | { kind: "unsafe" }
  | { kind: "unsupported"; scope: UnsupportedCourseStartScope; title: string };

type CourseStartRequestInput = Pick<
  CourseStartRequest,
  "canonicalTitle" | "courseMode" | "generationStatus" | "scope" | "targetLanguage"
>;

type CourseStartRequestWithCourse = CourseStartRequest & { course: Course | null };

/**
 * Finds the cached routing decision for this locale and prompt. The request row
 * is the durable boundary for the new start architecture, so repeat prompts can
 * skip both the scope router and canonical-title model task.
 */
async function findCachedStartRequest({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<CourseStartRequest | null> {
  return prisma.courseStartRequest.findUnique({
    where: { languageNormalizedPrompt: { language, normalizedPrompt: normalizeString(prompt) } },
  });
}

/**
 * Converts a persisted start request into route behavior. This is deliberately
 * the same mapping used for newly routed requests so cached prompts and first
 * submissions cannot drift.
 */
function getStartRequestResolution(request: CourseStartRequest): CourseStartRequestResolution {
  if (request.scope === "topic" || (request.scope === "language" && request.targetLanguage)) {
    return {
      kind: "generate",
      request: { canonicalTitle: request.canonicalTitle, id: request.id, scope: request.scope },
    };
  }

  if (request.scope === "exam") {
    return { href: "/start/exam", kind: "redirect" };
  }

  if (request.scope === "language") {
    return { href: "/start/speak", kind: "redirect" };
  }

  if (request.scope === "unsafe") {
    return { kind: "unsafe" };
  }

  return {
    kind: "unsupported",
    scope: request.scope,
    title: request.canonicalTitle ?? request.prompt,
  };
}

/**
 * Falls back to the learner prompt when the model returns an empty title. The
 * schema guarantees a string, but it cannot guarantee a useful non-empty title.
 */
function getResolvedTitle({ prompt, title }: { prompt: string; title: string }): string {
  const trimmedTitle = title.trim();

  if (trimmedTitle) {
    return trimmedTitle;
  }

  return prompt.trim();
}

/**
 * Maps the routed scope to the course mode implied by today's product. Topic
 * and language requests generate full courses, while question and personalized
 * requests are stored for waitlist/admin context before their workflows exist.
 */
function getCourseModeForScope(scope: CourseStartScope): CourseStartRequestInput["courseMode"] {
  if (scope === "topic" || scope === "language") {
    return "full";
  }

  if (scope === "exam") {
    return "exam";
  }

  if (scope === "question") {
    return "quick";
  }

  if (scope === "personalized") {
    return "personalized";
  }

  return null;
}

/**
 * Only requests that can enter the current course-generation workflow receive a
 * generation status. Redirect, waitlist, and blocked scopes are already fully
 * handled once the routing decision is stored.
 */
function getGenerationStatusForScope(
  scope: CourseStartScope,
  targetLanguage?: string | null,
): CourseStartRequestInput["generationStatus"] {
  if (scope === "topic" || (scope === "language" && targetLanguage)) {
    return "pending";
  }

  return null;
}

/**
 * Stores or reuses the routing decision as the first-class start request. The
 * unique prompt cache can be hit by concurrent first visits, so this keeps the
 * first persisted decision instead of letting the second request fail.
 */
async function upsertCourseStartRequest({
  language,
  prompt,
  request,
}: {
  language: string;
  prompt: string;
  request: CourseStartRequestInput;
}): Promise<CourseStartRequest> {
  const normalizedPrompt = normalizeString(prompt);

  return prisma.courseStartRequest.upsert({
    create: {
      canonicalTitle: request.canonicalTitle,
      courseMode: request.courseMode,
      generationStatus: request.generationStatus,
      language,
      normalizedPrompt,
      prompt,
      scope: request.scope,
      targetLanguage: request.targetLanguage,
    },
    update: {},
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
  });
}

/**
 * Converts the second-pass learn classification into the persisted scope used
 * by the start request. We keep `course` as the public AI-task label because it
 * is clearer in evals, while the database uses `topic` for reusable courses.
 */
function getScopeForLearnClassification(
  classification: LearnRequestClassification,
): LearnCourseStartScope {
  if (classification === "course") {
    return "topic";
  }

  return classification;
}

/**
 * Lets the coarse router win for requests that leave the learn flow, while
 * using the learn classifier to decide the persisted scope for normal learn
 * requests. Running both tasks together keeps the start page fast and still
 * gives the UI all model decisions it will need later.
 */
function getResolvedStartScope({
  classification,
  routeScope,
}: {
  classification: LearnRequestClassification;
  routeScope: CourseRequestScope;
}): CourseStartScope {
  if (routeScope !== "topic") {
    return routeScope;
  }

  return getScopeForLearnClassification(classification);
}

/**
 * Builds the persisted request fields for a newly routed prompt. Keeping this
 * mapper separate makes the launch limitation explicit: question and
 * personalized requests are recorded but not sent to generation yet.
 */
function getRoutedStartRequestInput({
  prompt,
  scope,
  title,
}: {
  prompt: string;
  scope: CourseStartScope;
  title: string;
}): CourseStartRequestInput {
  return {
    canonicalTitle: scope === "unsafe" ? null : getResolvedTitle({ prompt, title }),
    courseMode: getCourseModeForScope(scope),
    generationStatus: getGenerationStatusForScope(scope),
    scope,
    targetLanguage: null,
  };
}

/**
 * Finds a generation request by id. The generation page uses this instead of a
 * suggestion lookup, which keeps the browser and workflow aligned on the new
 * request boundary.
 */
export async function getCourseStartRequestById(
  id: string,
): Promise<CourseStartRequestWithCourse | null> {
  if (!isUuid(id)) {
    return null;
  }

  return prisma.courseStartRequest.findUnique({ include: { course: true }, where: { id } });
}

/**
 * Finds the request that owns an existing course shell. Course pages redirect
 * empty AI courses here so learners can resume the generation run that created
 * that shell.
 */
export async function getCourseStartRequestByCourseSlug({
  language,
  slug,
}: {
  language: string;
  slug: string;
}): Promise<CourseStartRequest | null> {
  const course = await prisma.course.findFirst({
    include: { startRequests: { orderBy: { createdAt: "asc" }, take: 1 } },
    where: { language, organization: { slug: AI_ORG_SLUG }, slug },
  });

  return course?.startRequests[0] ?? null;
}

/**
 * Creates the controlled request used by `/start/speak/[language]`. Language
 * courses still use the course-generation workflow, but the workflow input is a
 * language-scoped start request instead of an adapter row.
 */
export async function getOrCreateLanguageCourseStartRequest({
  language,
  targetLanguage,
  title,
}: {
  language: string;
  targetLanguage: string;
  title: string;
}): Promise<CourseStartRequest> {
  const prompt = `Learn ${title}`;
  const normalizedPrompt = normalizeString(prompt);

  const existing = await prisma.courseStartRequest.findUnique({
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
  });

  if (existing) {
    return existing;
  }

  return upsertCourseStartRequest({
    language,
    prompt,
    request: {
      canonicalTitle: title,
      courseMode: "full",
      generationStatus: "pending",
      scope: "language",
      targetLanguage,
    },
  });
}

/**
 * Resolves a `/start/learn` prompt into the next product surface. First-time
 * prompts run the route, learn-classification, and title tasks in one model
 * wave so the UI can later use every decision without adding latency today.
 */
export async function resolveCourseStartRequest({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<CourseStartRequestResolution> {
  const cachedRequest = await findCachedStartRequest({ language, prompt });

  if (cachedRequest) {
    return getStartRequestResolution(cachedRequest);
  }

  const [routing, classification, canonicalTitle] = await Promise.all([
    routeCourseRequest({ language, prompt }),
    classifyLearnRequest({ language, prompt }),
    generateCanonicalCourseTitle({ language, prompt }),
  ]);

  const scope = getResolvedStartScope({
    classification: classification.data.classification,
    routeScope: routing.data.scope,
  });

  const request = await upsertCourseStartRequest({
    language,
    prompt,
    request: getRoutedStartRequestInput({ prompt, scope, title: canonicalTitle.data.title }),
  });

  return getStartRequestResolution(request);
}
