import {
  type LanguageMultipleChoiceContent,
  type MultipleChoiceStepContent,
  parseStepContent,
} from "@zoonk/core/steps/content-contract";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { findActivityByKind } from "./_utils/find-activity-by-kind";
import { generateAudioForText } from "./_utils/generate-audio-for-text";
import { type LessonActivity } from "./get-lesson-activities-step";

function assertLanguageContent(content: MultipleChoiceStepContent): LanguageMultipleChoiceContent {
  if (content.kind !== "language") {
    throw new Error(`Expected language content, got ${content.kind}`);
  }

  return content;
}

function extractUniqueTexts(steps: { content: LanguageMultipleChoiceContent }[]): string[] {
  const texts = new Set<string>();

  for (const step of steps) {
    texts.add(step.content.context);

    for (const option of step.content.options) {
      texts.add(option.text);
    }
  }

  return [...texts];
}

export async function generateLanguagePracticeAudioStep(
  activities: LessonActivity[],
): Promise<void> {
  "use step";

  const activity = findActivityByKind(activities, "languagePractice");

  if (!activity) {
    return;
  }

  const course = activity.lesson.chapter.course;
  const targetLanguage = course.targetLanguage;

  await streamStatus({ status: "started", step: "generateLanguagePracticeAudio" });

  if (!isTTSSupportedLanguage(targetLanguage) || !course.organization) {
    await streamStatus({ status: "completed", step: "generateLanguagePracticeAudio" });
    return;
  }

  const organizationId = course.organization.id;

  const dbSteps = await prisma.step.findMany({
    select: { content: true, id: true },
    where: { activityId: activity.id, kind: "multipleChoice" },
  });

  const parsedSteps = dbSteps.map((step) => ({
    content: assertLanguageContent(parseStepContent("multipleChoice", step.content)),
    id: step.id,
  }));

  const uniqueTexts = extractUniqueTexts(parsedSteps);

  const existingAudios = await prisma.sentenceAudio.findMany({
    select: { audioUrl: true, sentence: true },
    where: { organizationId, sentence: { in: uniqueTexts }, targetLanguage },
  });

  const audioMap: Record<string, string> = Object.fromEntries(
    existingAudios.map((record) => [record.sentence, record.audioUrl]),
  );

  const textsNeedingAudio = uniqueTexts.filter((text) => !audioMap[text]);

  const results = await Promise.all(
    textsNeedingAudio.map((text) =>
      generateAudioForText(text, targetLanguage, course.organization?.slug),
    ),
  );

  const fulfilled = results.filter((result) => result !== null);

  await Promise.all(
    fulfilled.map((result) =>
      prisma.sentenceAudio.upsert({
        create: {
          audioUrl: result.audioUrl,
          organizationId,
          sentence: result.text,
          targetLanguage,
        },
        select: { id: true },
        update: { audioUrl: result.audioUrl },
        where: {
          orgSentenceAudio: { organizationId, sentence: result.text, targetLanguage },
        },
      }),
    ),
  );

  for (const result of fulfilled) {
    audioMap[result.text] = result.audioUrl;
  }

  const updates = parsedSteps.map((step) => {
    const updatedContent: LanguageMultipleChoiceContent = {
      ...step.content,
      contextAudioUrl: audioMap[step.content.context] ?? null,
      options: step.content.options.map((option) => ({
        ...option,
        audioUrl: audioMap[option.text] ?? null,
      })),
    };

    return prisma.step.update({
      data: { content: updatedContent },
      where: { id: step.id },
    });
  });

  const { error } = await safeAsync(() => Promise.all(updates));

  if (error || fulfilled.length < textsNeedingAudio.length) {
    await streamError({ reason: "enrichmentFailed", step: "generateLanguagePracticeAudio" });
  }

  await streamStatus({ status: "completed", step: "generateLanguagePracticeAudio" });
}
