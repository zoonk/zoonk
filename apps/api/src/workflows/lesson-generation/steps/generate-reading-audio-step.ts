import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { normalizePunctuation } from "@zoonk/utils/string";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { requireCompleteOptionalAudioBatch } from "./_utils/optional-audio-generation-error";
import { type LessonContext } from "./get-lesson-step";

type SentenceAudioRequest = { sourceText: string; storedText: string };
type SentenceAudioResult = { audioUrl: string; storedText: string };

/**
 * Keeps the first source text for each persisted sentence so punctuation variants
 * share one TTS request while retaining a stable text for the generated voice clip.
 */
function deduplicateSentenceAudioRequests(
  requests: SentenceAudioRequest[],
): SentenceAudioRequest[] {
  const requestsByStoredText = new Map<string, SentenceAudioRequest>();

  for (const request of requests) {
    if (!requestsByStoredText.has(request.storedText)) {
      requestsByStoredText.set(request.storedText, request);
    }
  }

  return [...requestsByStoredText.values()];
}

/**
 * Fans the canonical stored sentence audio back to every source spelling used by
 * lesson content because saving reads URLs through those original source strings.
 */
function mapSourceTextsToAudioUrls({
  audioByStoredText,
  requests,
}: {
  audioByStoredText: Record<string, string>;
  requests: SentenceAudioRequest[];
}): Record<string, string> {
  return Object.fromEntries(
    requests.flatMap((request) => {
      const audioUrl = audioByStoredText[request.storedText];
      return audioUrl ? [[request.sourceText, audioUrl]] : [];
    }),
  );
}

/**
 * Saves generated sentence audio under the same normalized sentence used by
 * lesson persistence, preventing a later run from uploading the clip again.
 */
async function generateAndPersistSentenceAudio({
  organizationId,
  orgSlug,
  request,
  targetLanguage,
}: {
  organizationId: string;
  orgSlug: string;
  request: SentenceAudioRequest;
  targetLanguage: string;
}): Promise<SentenceAudioResult | null> {
  const result = await generateAudioForText({
    language: targetLanguage,
    orgSlug,
    text: request.sourceText,
    textType: "sentence",
  });

  if (!result) {
    return null;
  }

  await prisma.sentence.upsert({
    create: {
      audioUrl: result.audioUrl,
      organizationId,
      sentence: request.storedText,
      targetLanguage,
    },
    update: { audioUrl: result.audioUrl },
    where: { orgSentence: { organizationId, sentence: request.storedText, targetLanguage } },
  });

  return { audioUrl: result.audioUrl, storedText: request.storedText };
}

/**
 * Generates every missing sentence clip in parallel, persists each successful
 * clip immediately, and fails the step when any optional clip remains missing
 * so Workflow can retry only the incomplete database records.
 */
export async function generateReadingAudioStep({
  context,
  sentences,
}: {
  context: LessonContext;
  sentences: ReadingLessonContent["sentences"];
}): Promise<{ sentenceAudioUrls: Record<string, string> }> {
  "use step";

  if (sentences.length === 0) {
    return { sentenceAudioUrls: {} };
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateReadingAudio" });

  const course = context.chapter.course;
  const organization = course.organization;
  const targetLanguage = course.targetLanguage;

  if (!targetLanguage || !isTTSSupportedLanguage(targetLanguage) || !organization) {
    await stream.status({ status: "completed", step: "generateReadingAudio" });
    return { sentenceAudioUrls: {} };
  }

  const requests = sentences.map((entry) => ({
    sourceText: entry.sentence,
    storedText: normalizePunctuation(entry.sentence),
  }));

  const existingSentences = await prisma.sentence.findMany({
    where: {
      organizationId: organization.id,
      sentence: { in: requests.map((request) => request.storedText) },
      targetLanguage,
    },
  });

  const existingAudioBySentence = Object.fromEntries(
    existingSentences.flatMap((record) =>
      record.audioUrl ? [[record.sentence, record.audioUrl]] : [],
    ),
  );

  const sentencesNeedingAudio = deduplicateSentenceAudioRequests(
    requests.filter((request) => !existingAudioBySentence[request.storedText]),
  );

  const results = await Promise.allSettled(
    sentencesNeedingAudio.map((request) =>
      generateAndPersistSentenceAudio({
        orgSlug: organization.slug,
        organizationId: organization.id,
        request,
        targetLanguage,
      }),
    ),
  );

  requireCompleteOptionalAudioBatch({
    results,
    texts: sentencesNeedingAudio.map((request) => request.sourceText),
  });

  const generatedAudioBySentence = Object.fromEntries(
    results.flatMap((result) =>
      result.status === "fulfilled" && result.value
        ? [[result.value.storedText, result.value.audioUrl]]
        : [],
    ),
  );

  await stream.status({ status: "completed", step: "generateReadingAudio" });

  return {
    sentenceAudioUrls: mapSourceTextsToAudioUrls({
      audioByStoredText: { ...existingAudioBySentence, ...generatedAudioBySentence },
      requests,
    }),
  };
}
