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
}): Promise<{ audioUrl: string; text: string } | null> {
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

  return result;
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

  const existingAudioUrls = Object.fromEntries(
    requests.flatMap((request) => {
      const audioUrl = existingAudioBySentence[request.storedText];
      return audioUrl ? [[request.sourceText, audioUrl]] : [];
    }),
  );

  const sentencesNeedingAudio = requests.filter(
    (request) => !existingAudioBySentence[request.storedText],
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

  await stream.status({ status: "completed", step: "generateReadingAudio" });

  return {
    sentenceAudioUrls: {
      ...existingAudioUrls,
      ...Object.fromEntries(
        results.flatMap((result) =>
          result.status === "fulfilled" && result.value
            ? [[result.value.text, result.value.audioUrl]]
            : [],
        ),
      ),
    },
  };
}
