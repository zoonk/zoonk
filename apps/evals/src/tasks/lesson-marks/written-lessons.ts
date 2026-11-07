import { z } from "zod";
import lessons from "./written-lessons.json" with { type: "json" };

const marksLessonSchema = z.object({
  ideas: z.array(z.object({ label: z.string().nullable(), text: z.string() })),
  language: z.string(),
  lessonTitle: z.string(),
  level: z.string(),
  screens: z.array(
    z.object({
      hasVisual: z.boolean(),
      kind: z.enum(["explanation", "guess", "question", "workedExample"]),
      text: z.string(),
      title: z.string().nullable(),
    }),
  ),
});

export type MarksLessonId = keyof typeof lessons;

/**
 * Lessons the current writer wrote (Nov 2026), as tagging reads their screens once saved: the
 * lesson-spec cases "Ativo e passivo", "Receitas e despesas" and "Átomos e elétrons de valência",
 * one each in Spanish, German and Japanese, lesson-writer eval outputs, two lessons a persona
 * walk played ("Fases do ciclo celular" and "Juros sobre juros"), copied from its screenshots, and
 * two whose tagged ideas went back in the map ("Por que o elétron não cai no núcleo?" and
 * "Comprimento de onda a partir da energia do fóton").
 */
const MARKS_LESSONS = z.record(z.string(), marksLessonSchema).parse(lessons);

export function getMarksLesson(id: MarksLessonId) {
  const lesson = MARKS_LESSONS[id];

  if (!lesson) {
    throw new Error(`No written lesson ${id}`);
  }

  return lesson;
}
