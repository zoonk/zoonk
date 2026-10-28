import "server-only";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import {
  type LanguageLessonContent,
  generateLanguageLesson,
} from "@zoonk/ai/tasks/v2/language/language-lesson";
import { prisma } from "@zoonk/db";
import { isSameLanguage } from "@zoonk/utils/languages";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { finishLibraryGeneration } from "../claims/generation-claim";
import { cleanLanguageLesson } from "./_utils/clean-language-lesson";
import { fillMissingAudio } from "./_utils/language-audio";
import { loadLanguageLessonInputs } from "./_utils/language-lesson-inputs";
import { buildLanguageLessonSteps } from "./_utils/language-lesson-steps";
import { saveLanguageLesson } from "./_utils/save-language-lesson";
import { type SharedVocabulary, saveSharedVocabulary } from "./_utils/shared-vocabulary";

type Analytics = Parameters<typeof generateLanguageLesson>[0]["analytics"];

const MIN_SENTENCES = 2;

type WriteLanguageLessonResult =
  | { status: "notClaimed" }
  | { status: "notLanguageLesson" }
  | { status: "heldBack" }
  | { sentenceCount: number; status: "published"; stepCount: number; wordCount: number };

async function getSharedOrganization() {
  return prisma.organization.findUniqueOrThrow({ where: { slug: AI_ORG_SLUG } });
}

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

/** Internal workflow bridge: the caller must hold the lesson's content claim. */
export async function writeLanguageLessonContent({
  analytics,
  lessonId,
  serviceTier,
  workflowRunId,
}: {
  analytics?: Analytics;
  lessonId: string;
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
    sameLanguage: isSameLanguage(inputs),
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

  const steps = buildLanguageLessonSteps({
    ...stored,
    learnerLanguage: inputs.learnerLanguage,
    targetLanguage: inputs.targetLanguage,
  });

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
