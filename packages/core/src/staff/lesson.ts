import "server-only";
import { type z } from "zod";
import { parseChallengeLessonSpec } from "../library/challenges/challenge-lesson-spec";
import { parseStoredLessonSpec } from "../library/lessons/_utils/stored-lesson-spec";
import { readSavedLessonMap } from "../library/lessons/lesson-map";
import { CURRENT_STEPS } from "../library/lessons/lesson-versions";
import { readSavedStepMarks } from "../library/marks/step-marks";
import { staffLessonParamsSchema, type staffLessonSchema } from "./lesson-contract";
import { staffRead, staffTransaction } from "./read";

async function readLesson(lessonId: string) {
  const lesson = await staffTransaction(
    (db) =>
      db.lesson.findUnique({
        select: {
          id: true,
          language: true,
          sentences: {
            orderBy: [{ position: "asc" }, { sentenceId: "asc" }],
            select: {
              distractors: true,
              explanation: true,
              otherSentenceOrders: true,
              otherTranslationOrders: true,
              position: true,
              sentence: {
                select: { audioUrl: true, id: true, romanization: true, sentence: true },
              },
              translation: true,
              translationDistractors: true,
            },
          },
          spec: true,
          steps: {
            orderBy: { position: "asc" },
            select: {
              content: true,
              id: true,
              kind: true,
              marks: true,
              mediaAssetId: true,
              position: true,
              sentence: { select: { sentence: true } },
              sentenceId: true,
              skillId: true,
              variants: { orderBy: { id: "asc" }, select: { content: true, id: true } },
              version: true,
              word: { select: { word: true } },
              wordId: true,
            },
            where: CURRENT_STEPS,
          },
          summary: true,
          targetLanguage: true,
          title: true,
          words: {
            orderBy: [{ position: "asc" }, { wordId: "asc" }],
            select: {
              distractors: true,
              note: true,
              position: true,
              translation: true,
              word: { select: { audioUrl: true, id: true, romanization: true, word: true } },
            },
          },
        },
        where: { id: lessonId },
      }),
    { isolationLevel: "RepeatableRead" },
  );

  if (!lesson) {
    return { message: `No Lesson with id ${lessonId}.`, rows: 0, status: "notFound" as const };
  }

  const { id, language, sentences, spec, steps, summary, targetLanguage, title, words } = lesson;
  const ideas = readSavedLessonMap(summary)?.ideas ?? [];

  const data = {
    id,
    ideas: ideas.map(({ label, text }) => ({ label, text })),
    language,
    plan: parseChallengeLessonSpec(spec) ?? parseStoredLessonSpec(spec),
    screens: steps.map(({ marks, sentence, version: _version, word, ...step }) => ({
      ...step,
      ideaIndex: readSavedStepMarks(marks)?.ideaIndex ?? null,
      sentence: sentence?.sentence ?? null,
      word: word?.word ?? null,
    })),
    sentences: sentences.map(({ sentence: { audioUrl, ...sentence }, ...row }) => ({
      ...row,
      ...sentence,
      audioAvailable: Boolean(audioUrl),
    })),
    targetLanguage,
    title,
    version: steps[0]?.version ?? null,
    words: words.map(({ word: { audioUrl, ...word }, ...row }) => ({
      ...row,
      ...word,
      audioAvailable: Boolean(audioUrl),
    })),
  } satisfies z.infer<typeof staffLessonSchema>;

  const variants = steps.reduce((total, step) => total + step.variants.length, 0);
  return { data, rows: 1 + steps.length + variants + words.length + sentences.length };
}

export function getStaffLesson(input: unknown) {
  return staffRead<z.infer<typeof staffLessonSchema>, z.infer<typeof staffLessonParamsSchema>>({
    call: { model: "Lesson", verb: "lesson" },
    input,
    run: ({ lessonId }) => readLesson(lessonId),
    schema: staffLessonParamsSchema,
  });
}
