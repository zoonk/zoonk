import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";

export type GeneratedLessonAudioResource = {
  id: string;
  kind: "alphabet" | "sentence" | "word";
  text: string;
};

/**
 * Collects target-language distractors whose audio is stored in the reusable
 * Word table even though the lesson references their surface text indirectly.
 */
function getDistractorTexts({
  sourceSentences,
  sourceWords,
}: {
  sourceSentences: { distractors: string[] }[];
  sourceWords: { distractors: string[] }[];
}): string[] {
  return [
    ...new Set([
      ...sourceWords.flatMap((entry) => entry.distractors),
      ...sourceSentences.flatMap((entry) => entry.distractors),
    ]),
  ];
}

/**
 * Loads distractor Word rows only when the lesson belongs to an organization
 * and language course, which are the keys that define reusable word audio.
 */
async function listDistractorWords({
  organizationId,
  targetLanguage,
  texts,
}: {
  organizationId: string | null;
  targetLanguage: string | null;
  texts: string[];
}) {
  if (!(organizationId && targetLanguage && texts.length > 0)) {
    return [];
  }

  return prisma.word.findMany({
    where: { organizationId, targetLanguage, word: { in: texts, mode: "insensitive" } },
  });
}

/**
 * Produces one admin row per reusable audio resource even when a canonical
 * word also appears as a distractor elsewhere in the same lesson.
 */
function deduplicateAudioResources(
  resources: GeneratedLessonAudioResource[],
): GeneratedLessonAudioResource[] {
  return Object.values(
    Object.fromEntries(resources.map((resource) => [`${resource.kind}:${resource.id}`, resource])),
  );
}

const cachedGetGeneratedLessonAudio = cacheAdminData(async (lessonId: string) => {
  const lesson = await prisma.lesson.findUnique({
    include: {
      chapter: { include: { course: true } },
      sourceSentences: { include: { sentence: true } },
      sourceWords: { include: { word: true } },
      steps: { where: { kind: "alphabet" } },
    },
    where: { id: lessonId },
  });

  if (!lesson) {
    return null;
  }

  const distractorTexts = getDistractorTexts({
    sourceSentences: lesson.sourceSentences,
    sourceWords: lesson.sourceWords,
  });

  const distractorWords = await listDistractorWords({
    organizationId: lesson.chapter.course.organizationId,
    targetLanguage: lesson.chapter.course.targetLanguage,
    texts: distractorTexts,
  });

  const missingAudio = deduplicateAudioResources([
    ...lesson.steps.flatMap((step) => {
      const content = parseStepContent("alphabet", step.content);

      return content.audioUrl
        ? []
        : [{ id: step.id, kind: "alphabet" as const, text: content.audioText }];
    }),
    ...lesson.sourceWords.flatMap((entry) =>
      entry.word.audioUrl
        ? []
        : [{ id: entry.word.id, kind: "word" as const, text: entry.word.word }],
    ),
    ...distractorWords.flatMap((word) =>
      word.audioUrl ? [] : [{ id: word.id, kind: "word" as const, text: word.word }],
    ),
    ...lesson.sourceSentences.flatMap((entry) =>
      entry.sentence.audioUrl
        ? []
        : [{ id: entry.sentence.id, kind: "sentence" as const, text: entry.sentence.sentence }],
    ),
  ]);

  return {
    lesson: {
      chapter: { id: lesson.chapter.id, title: lesson.chapter.title },
      course: { id: lesson.chapter.course.id, title: lesson.chapter.course.title },
      generationStatus: lesson.generationStatus,
      id: lesson.id,
      kind: lesson.kind,
      title: lesson.title,
    },
    missingAudio,
  };
});

/**
 * Gives the admin lesson detail page the saved lesson identity and only the
 * symbol, word, or sentence resources that still need a manual audio file.
 */
export async function getGeneratedLessonAudio(lessonId: string) {
  return cachedGetGeneratedLessonAudio(lessonId);
}
