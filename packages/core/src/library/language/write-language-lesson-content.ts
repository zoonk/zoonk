import "server-only";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import {
  type LanguageLessonContent,
  generateLanguageLesson,
} from "@zoonk/ai/tasks/v2/language/language-lesson";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { finishLibraryGeneration } from "../claims/generation-claim";
import { cleanLanguageLesson } from "./_utils/clean-language-lesson";
import { fillMissingAudio } from "./_utils/language-audio";
import { loadLanguageLessonInputs } from "./_utils/language-lesson-inputs";
import { buildLanguageLessonSteps } from "./_utils/language-lesson-steps";
import { saveLanguageLesson } from "./_utils/save-language-lesson";
import { type SharedVocabulary, saveSharedVocabulary } from "./_utils/shared-vocabulary";

type Analytics = Parameters<typeof generateLanguageLesson>[0]["analytics"];

/** Fewer than this and there is nothing to build, listen to or say. */
const MIN_SENTENCES = 2;

type WriteLanguageLessonResult =
  | { status: "notClaimed" }
  | { status: "notLanguageLesson" }
  | { status: "heldBack" }
  | { sentenceCount: number; status: "published"; stepCount: number; wordCount: number };

/** Shared words, sentences and audio belong to the AI organization, like the courses it writes. */
async function getSharedOrganization() {
  return prisma.organization.findUniqueOrThrow({ where: { slug: AI_ORG_SLUG } });
}

/**
 * Keeps the words and sentences that have a shared row, with their ids in the
 * same order, so every link and screen points at a stored row.
 */
function withSharedIds({
  content,
  shared,
}: {
  content: LanguageLessonContent;
  shared: SharedVocabulary;
}) {
  const words = content.words.flatMap((word) => {
    const id = shared.wordIdsByText.get(word.word);
    return id ? [{ id, word }] : [];
  });

  const sentences = content.sentences.flatMap((sentence) => {
    const id = shared.sentenceIdsByText.get(sentence.sentence);
    return id ? [{ id, sentence }] : [];
  });

  return {
    content: {
      ...content,
      sentences: sentences.map((item) => item.sentence),
      words: words.map((item) => item.word),
    },
    sentenceIds: sentences.map((item) => item.id),
    wordIds: words.map((item) => item.id),
  };
}

/**
 * Writes a language lesson for its language pair, for the workflow run that
 * holds the lesson's content claim. The writer drafts the words, sentences,
 * tip, practice, writing prompt and summary; code repairs what it can; the
 * target-language words and sentences are stored where every pair can reuse
 * them, with audio made only for the ones nobody voiced yet; and the lesson is
 * published with its screens. A draft left without words or with too few
 * sentences is held back and the claim ends as failed, so a later run retries.
 *
 * This is an internal workflow bridge: Library content is shared and no
 * learner's data is written.
 */
export async function writeLanguageLessonContent({
  analytics,
  lessonId,
  serviceTier,
  workflowRunId,
}: {
  analytics?: Analytics;
  lessonId: string;
  /** `flex` when the lesson is written well before a learner reaches it. */
  serviceTier?: ServiceTier;
  workflowRunId: string;
}): Promise<WriteLanguageLessonResult> {
  const state = await loadLanguageLessonInputs({ lessonId, workflowRunId });

  if (state.status !== "ready") {
    return state;
  }

  const { inputs } = state;

  const [draft, organization] = await Promise.all([
    generateLanguageLesson({
      ...inputs.writerInput,
      analytics: { contentScope: "shared", traceId: workflowRunId, ...analytics },
      serviceTier,
    }),
    getSharedOrganization(),
  ]);

  const cleaned = cleanLanguageLesson({
    content: draft.data,
    knownWords: inputs.writerInput.knownWords ?? [],
  });

  if (cleaned.words.length === 0 || cleaned.sentences.length < MIN_SENTENCES) {
    await finishLibraryGeneration({
      id: lessonId,
      status: "failed",
      target: "lessonContent",
      workflowRunId,
    });

    return { status: "heldBack" };
  }

  const shared = await saveSharedVocabulary({
    content: cleaned,
    learnerLanguage: inputs.learnerLanguage,
    organizationId: organization.id,
    provenance: draft.provenance,
    targetLanguage: inputs.targetLanguage,
  });

  const stored = withSharedIds({ content: cleaned, shared });

  await fillMissingAudio({
    orgSlug: organization.slug,
    sentenceIds: stored.sentenceIds,
    targetLanguage: inputs.targetLanguage,
    wordIds: [...shared.wordIdsByText.values()],
  });

  const steps = buildLanguageLessonSteps({ ...stored, targetLanguage: inputs.targetLanguage });

  const saved = await saveLanguageLesson({
    ...stored,
    lessonId,
    provenance: draft.provenance,
    skillId: inputs.skillId,
    steps,
    workflowRunId,
  });

  if (!saved) {
    return { status: "notClaimed" };
  }

  return {
    sentenceCount: stored.sentenceIds.length,
    status: "published",
    stepCount: steps.length,
    wordCount: stored.wordIds.length,
  };
}
