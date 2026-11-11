import "server-only";
import { type ServedSpeed, type ServiceTier } from "@zoonk/ai/provider-options";
import {
  type LanguageLessonContent,
  generateLanguageLesson,
} from "@zoonk/ai/tasks/language/language-lesson";
import { prisma } from "@zoonk/db";
import { isSameLanguage } from "@zoonk/utils/languages";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import {
  listTargetBankWords,
  normalizeWordKey,
} from "../../player/contracts/build-word-bank-options";
import { type LibraryProvenance } from "../_utils/library-rows";
import { finishLibraryGeneration } from "../claims/generation-claim";
import { cleanLanguageLesson } from "./_utils/clean-language-lesson";
import { fillMissingAudio } from "./_utils/language-audio";
import {
  type LanguageLessonInputs,
  loadLanguageLessonInputs,
} from "./_utils/language-lesson-inputs";
import { buildLanguageLessonSteps } from "./_utils/language-lesson-steps";
import { saveLanguageLesson } from "./_utils/save-language-lesson";
import {
  type SharedVocabulary,
  saveBankWords,
  saveSharedVocabulary,
} from "./_utils/shared-vocabulary";

type Analytics = Parameters<typeof generateLanguageLesson>[0]["analytics"];

const MIN_SENTENCES = 2;

export type LanguageLessonDraft = {
  inputs: LanguageLessonInputs;
  lesson: LanguageLessonContent;
  provenance: LibraryProvenance;
};

type WriteLanguageLessonResult =
  | { status: "notClaimed" }
  | { status: "notLanguageLesson" }
  | { status: "heldBack" }
  | { draft: LanguageLessonDraft; status: "drafted" };

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
    sentencesById: new Map(sentences.map((item) => [item.id, item.sentence])),
    wordIds: words.map((item) => item.id),
  };
}

/** The writer's output with what a learner can't use dropped, or null when too little is left. */
export function cleanWrittenLanguageLesson({
  content,
  inputs,
}: {
  content: LanguageLessonContent;
  inputs: LanguageLessonInputs;
}): LanguageLessonContent | null {
  const cleaned = cleanLanguageLesson({
    content,
    knownWords: inputs.writerInput.knownWords ?? [],
    sameLanguage: isSameLanguage(inputs),
  });

  return cleaned.words.length === 0 || cleaned.sentences.length < MIN_SENTENCES ? null : cleaned;
}

/**
 * Saves the lesson's shared words and sentences, the tiles its screens show and their audio, and
 * returns the rows a version of the lesson saves.
 */
async function storeLanguageLesson({
  content,
  inputs,
  lessonId,
  provenance,
}: {
  content: LanguageLessonContent;
  inputs: LanguageLessonInputs;
  lessonId: string;
  provenance: LibraryProvenance;
}): Promise<Omit<Parameters<typeof saveLanguageLesson>[0], "workflowRunId">> {
  const organization = await getSharedOrganization();

  const shared = await saveSharedVocabulary({
    content,
    learnerLanguage: inputs.learnerLanguage,
    organizationId: organization.id,
    provenance,
    targetLanguage: inputs.targetLanguage,
  });

  const stored = withSharedIds({ content, shared });

  const steps = buildLanguageLessonSteps({
    ...stored,
    learnerLanguage: inputs.learnerLanguage,
    targetLanguage: inputs.targetLanguage,
  });

  const toKey = (word: string) => normalizeWordKey({ language: inputs.targetLanguage, word });
  const lessonWordKeys = new Set([...shared.wordIdsByText.keys()].map((text) => toKey(text)));

  const bankWordIds = await saveBankWords({
    organizationId: organization.id,
    provenance,
    targetLanguage: inputs.targetLanguage,
    texts: listTargetBankWords({ sentences: stored.sentencesById, steps }).filter(
      (word) => !lessonWordKeys.has(toKey(word)),
    ),
  });

  await fillMissingAudio({
    orgSlug: organization.slug,
    sentenceIds: stored.sentenceIds,
    targetLanguage: inputs.targetLanguage,
    wordIds: [...shared.wordIdsByText.values(), ...bankWordIds.values()],
  });

  return {
    content: stored.content,
    lessonId,
    provenance,
    sentenceIds: stored.sentenceIds,
    skillId: inputs.skillId,
    steps,
    wordIds: stored.wordIds,
  };
}

/** Internal workflow bridge: the caller must hold the lesson's content claim. */
export async function writeLanguageLessonDraft({
  analytics,
  lessonId,
  serviceTier,
  speed,
  workflowRunId,
}: {
  analytics?: Analytics;
  lessonId: string;
  serviceTier?: ServiceTier;
  speed?: ServedSpeed;
  workflowRunId: string;
}): Promise<WriteLanguageLessonResult> {
  const state = await loadLanguageLessonInputs({ lessonId, workflowRunId });

  if (state.status !== "ready") {
    return state;
  }

  const { inputs } = state;

  const written = await generateLanguageLesson({
    ...inputs.writerInput,
    analytics: { contentScope: "shared", traceId: workflowRunId, ...analytics },
    serviceTier,
    speed,
  });

  const lesson = cleanWrittenLanguageLesson({ content: written.data, inputs });

  if (!lesson) {
    await finishLibraryGeneration({
      id: lessonId,
      status: "failed",
      target: "lessonContent",
      workflowRunId,
    });

    return { status: "heldBack" };
  }

  return { draft: { inputs, lesson, provenance: written.provenance }, status: "drafted" };
}

/** Internal workflow bridge: false when `workflowRunId` no longer holds the lesson's content claim. */
export async function publishLanguageLessonDraft({
  draft,
  lessonId,
  workflowRunId,
}: {
  draft: LanguageLessonDraft;
  lessonId: string;
  workflowRunId: string;
}): Promise<boolean> {
  const rows = await storeLanguageLesson({
    content: draft.lesson,
    inputs: draft.inputs,
    lessonId,
    provenance: draft.provenance,
  });

  return saveLanguageLesson({ ...rows, workflowRunId });
}
