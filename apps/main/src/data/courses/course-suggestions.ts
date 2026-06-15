import "server-only";
import { generateCourseDescription } from "@zoonk/ai/tasks/courses/description";
import { type CourseGoal, routeCourseGoal } from "@zoonk/ai/tasks/courses/goal-routing";
import { resolveCourseLearnLanguage } from "@zoonk/ai/tasks/courses/learn-language";
import { generateCourseSuggestions as generateTask } from "@zoonk/ai/tasks/courses/suggestions";
import { type CourseSuggestion, getAiGenerationCourseWhere, prisma } from "@zoonk/db";
import { getLanguageName } from "@zoonk/utils/languages";
import { normalizeString, removeLocaleSuffix, toSlug } from "@zoonk/utils/string";
import { isUuid } from "@zoonk/utils/uuid";

type SuggestionResult = Pick<CourseSuggestion, "id" | "title" | "description" | "targetLanguage">;
type SupportedCourseGoal = Extract<CourseGoal, "masterSubject" | "learnLanguage">;
type UnsupportedCourseGoal = Exclude<CourseGoal, SupportedCourseGoal | "unsafe">;

type CourseSuggestionsGoalResult = {
  kind: "courseSuggestions";
  goal: SupportedCourseGoal;
  id: string;
  language: string;
  prompt: string;
  sourcePrompt: string;
  suggestions: SuggestionResult[];
};

type ComingSoonGoalResult = { kind: "comingSoon"; goal: UnsupportedCourseGoal; prompt: string };

type UnsafeGoalResult = { kind: "unsafe"; prompt: string };

export type LearningGoalResult =
  | CourseSuggestionsGoalResult
  | ComingSoonGoalResult
  | UnsafeGoalResult;

async function findSearchPrompt(params: { language: string; prompt: string }) {
  const { language, prompt: rawPrompt } = params;
  const prompt = normalizeString(rawPrompt);

  return prisma.searchPrompt.findUnique({
    include: { suggestions: { include: { courseSuggestion: true }, orderBy: { position: "asc" } } },
    where: { languagePrompt: { language, prompt } },
  });
}

type SuggestionInput = { title: string; description: string; targetLanguage: string | null };

/**
 * Converts a persisted search prompt link into the small suggestion shape used
 * by the learn page. This keeps cached and newly generated paths returning the
 * same data contract.
 */
function toSuggestionResult(link: { courseSuggestion: CourseSuggestion }): SuggestionResult {
  return {
    description: link.courseSuggestion.description,
    id: link.courseSuggestion.id,
    targetLanguage: link.courseSuggestion.targetLanguage,
    title: link.courseSuggestion.title,
  };
}

/**
 * Reads the reusable suggestion cache for an exact normalized prompt. Routing
 * happens only when this returns null, so existing reviewed suggestion pages do
 * not spend AI credits just to rediscover the same reusable courses.
 */
async function getCachedSuggestions(params: {
  language: string;
  prompt: string;
}): Promise<{ id: string; suggestions: SuggestionResult[] } | null> {
  const record = await findSearchPrompt(params);

  if (!record || record.suggestions.length === 0) {
    return null;
  }

  return { id: record.id, suggestions: record.suggestions.map(toSuggestionResult) };
}

async function upsertSearchPromptWithSuggestions(input: {
  language: string;
  prompt: string;
  suggestions: SuggestionInput[];
}): Promise<{ id: string; suggestions: SuggestionResult[] }> {
  const { language, prompt: rawPrompt, suggestions } = input;
  const prompt = normalizeString(rawPrompt);

  return prisma.$transaction(async (tx) => {
    const searchPrompt = await tx.searchPrompt.upsert({
      create: { language, prompt },
      update: {},
      where: { languagePrompt: { language, prompt } },
    });

    const results = await Promise.all(
      suggestions.map(async (suggestion, idx) => {
        const slug = toSlug(suggestion.title);

        const courseSuggestion = await tx.courseSuggestion.upsert({
          create: {
            description: suggestion.description,
            language,
            slug,
            targetLanguage: suggestion.targetLanguage,
            title: suggestion.title,
          },
          update: {},
          where: { languageSlug: { language, slug } },
        });

        await tx.searchPromptSuggestion.upsert({
          create: {
            courseSuggestionId: courseSuggestion.id,
            position: idx,
            searchPromptId: searchPrompt.id,
          },
          update: { position: idx },
          where: {
            promptSuggestion: {
              courseSuggestionId: courseSuggestion.id,
              searchPromptId: searchPrompt.id,
            },
          },
        });

        return {
          description: courseSuggestion.description,
          id: courseSuggestion.id,
          targetLanguage: courseSuggestion.targetLanguage,
          title: courseSuggestion.title,
        };
      }),
    );

    return { id: searchPrompt.id, suggestions: results };
  });
}

function resolveLanguageSuggestion(
  suggestion: { title: string; description: string; targetLanguageCode: string | null },
  language: string,
): SuggestionInput {
  if (!suggestion.targetLanguageCode) {
    return { description: suggestion.description, targetLanguage: null, title: suggestion.title };
  }

  const title = getLanguageName({
    targetLanguage: suggestion.targetLanguageCode,
    userLanguage: language,
  });

  return {
    description: suggestion.description,
    targetLanguage: suggestion.targetLanguageCode,
    title,
  };
}

function deduplicateByTargetLanguage(suggestions: SuggestionInput[]): SuggestionInput[] {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    if (!suggestion.targetLanguage) {
      return true;
    }

    if (seen.has(suggestion.targetLanguage)) {
      return false;
    }

    seen.add(suggestion.targetLanguage);
    return true;
  });
}

/**
 * Shapes cached or generated suggestions as the learn route result. The
 * display prompt can differ from the original prompt for language goals where
 * the page should show the target language name instead of the raw learner text.
 */
function toCourseSuggestionsGoalResult({
  goal,
  id,
  language,
  prompt,
  sourcePrompt,
  suggestions,
}: {
  goal: SupportedCourseGoal;
  id: string;
  language: string;
  prompt: string;
  sourcePrompt: string;
  suggestions: SuggestionResult[];
}): CourseSuggestionsGoalResult {
  return { goal, id, kind: "courseSuggestions", language, prompt, sourcePrompt, suggestions };
}

/**
 * Normalizes model-returned language codes before using them as cache keys,
 * prompt languages, or course metadata. Language tasks should return base
 * codes like `pt`, but reducing accidental regional variants such as `pt-BR`
 * keeps our defaults in one place: prompt helpers map `pt` to Brazilian
 * Portuguese and `en` to US English when a task needs dialect wording.
 */
function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase().split("-")[0] ?? "";
}

/**
 * Sends a broad reusable subject into the existing course-suggestion task. The
 * router's job is only to keep unsupported goals out of this broad-course flow;
 * course suggestions already owns title normalization and related suggestions.
 */
async function generateMasterSubjectSuggestions({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<CourseSuggestionsGoalResult> {
  const result = await generateCourseSuggestions({ language, prompt });

  return toCourseSuggestionsGoalResult({
    goal: "masterSubject",
    id: result.id,
    language,
    prompt,
    sourcePrompt: prompt,
    suggestions: result.suggestions,
  });
}

/**
 * Creates the current full language-course suggestion from an inferred language
 * pair. The title is deterministic from Intl language names, while the
 * description still uses the shared course-description task so it matches the
 * rest of the catalog.
 */
async function generateLearnLanguageSuggestion({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<CourseSuggestionsGoalResult> {
  const { data } = await resolveCourseLearnLanguage({ language, prompt });
  const userLanguage = normalizeLanguageCode(data.userLanguage);
  const targetLanguage = normalizeLanguageCode(data.targetLanguage);
  const title = getLanguageName({ targetLanguage, userLanguage });
  const cached = await getCachedSuggestions({ language: userLanguage, prompt });

  if (cached) {
    return toCourseSuggestionsGoalResult({
      goal: "learnLanguage",
      id: cached.id,
      language: userLanguage,
      prompt: title,
      sourcePrompt: prompt,
      suggestions: cached.suggestions,
    });
  }

  const description = await generateCourseDescription({ language: userLanguage, title });

  const result = await upsertSearchPromptWithSuggestions({
    language: userLanguage,
    prompt,
    suggestions: [{ description: description.data.description, targetLanguage, title }],
  });

  return toCourseSuggestionsGoalResult({
    goal: "learnLanguage",
    id: result.id,
    language: userLanguage,
    prompt: title,
    sourcePrompt: prompt,
    suggestions: result.suggestions,
  });
}

/**
 * Dispatches the routed goal to the generation mode Zoonk currently supports.
 * Unsupported modes return explicit states for the page instead of creating
 * misleading reusable course suggestions.
 */
async function generateRoutedGoalSuggestions({
  goal,
  language,
  prompt,
}: {
  goal: CourseGoal;
  language: string;
  prompt: string;
}): Promise<LearningGoalResult> {
  if (goal === "masterSubject") {
    return generateMasterSubjectSuggestions({ language, prompt });
  }

  if (goal === "learnLanguage") {
    return generateLearnLanguageSuggestion({ language, prompt });
  }

  if (goal === "unsafe") {
    return { kind: "unsafe", prompt };
  }

  return { goal, kind: "comingSoon", prompt };
}

/**
 * Generates the learn-page result for a raw learner goal. Cached prompts reuse
 * the existing reviewed suggestion set; uncached prompts are routed before any
 * new reusable catalog rows are created.
 */
export async function generateLearningGoalSuggestions({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<LearningGoalResult> {
  const cached = await getCachedSuggestions({ language, prompt });

  if (cached) {
    return toCourseSuggestionsGoalResult({
      goal: "masterSubject",
      id: cached.id,
      language,
      prompt,
      sourcePrompt: prompt,
      suggestions: cached.suggestions,
    });
  }

  const { data } = await routeCourseGoal({ prompt });
  return generateRoutedGoalSuggestions({ goal: data.goal, language, prompt });
}

export async function generateCourseSuggestions({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<{ id: string; suggestions: SuggestionResult[] }> {
  const cached = await getCachedSuggestions({ language, prompt });

  if (cached) {
    return cached;
  }

  const { data } = await generateTask({ language, prompt });

  const resolved = data.map((item) => resolveLanguageSuggestion(item, language));
  const deduplicated = deduplicateByTargetLanguage(resolved);

  return upsertSearchPromptWithSuggestions({ language, prompt, suggestions: deduplicated });
}

/**
 * Course suggestion pages render a 404 when the suggestion lookup returns
 * `null`. Returning `null` for malformed ids preserves that behavior for bad
 * route params instead of surfacing a Prisma UUID parsing error.
 */
export async function getCourseSuggestionById(id: string): Promise<CourseSuggestion | null> {
  if (!isUuid(id)) {
    return null;
  }

  return prisma.courseSuggestion.findUnique({ where: { id } });
}

/**
 * Loads the AI-catalog course already chosen for a suggestion. Course identity
 * resolution happens in the generation workflow, and server pages use this link
 * to avoid repeating semantic duplicate checks during render.
 */
export async function getLinkedCourseForSuggestion({
  courseId,
}: Pick<CourseSuggestion, "courseId">) {
  if (!courseId) {
    return null;
  }

  return prisma.course.findFirst({ where: getAiGenerationCourseWhere({ id: courseId }) });
}

export async function getCourseSuggestionBySlug({
  slug,
  language,
}: {
  slug: string;
  language: string;
}): Promise<CourseSuggestion | null> {
  const normalizedSlug = removeLocaleSuffix(slug, language);

  return prisma.courseSuggestion.findUnique({
    where: { languageSlug: { language, slug: normalizedSlug } },
  });
}
