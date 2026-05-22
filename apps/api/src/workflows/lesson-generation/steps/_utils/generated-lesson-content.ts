import { type LessonPracticeSchema } from "@zoonk/ai/tasks/lessons/core/practice";
import { type QuizQuestion } from "@zoonk/ai/tasks/lessons/core/quiz";
import { type LessonAlphabetSchema } from "@zoonk/ai/tasks/lessons/language/alphabet";
import { type LessonGrammarContentSchema } from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { type LessonGrammarUserContentSchema } from "@zoonk/ai/tasks/lessons/language/grammar-user-content";
import { type LessonSentencesSchema } from "@zoonk/ai/tasks/lessons/language/sentences";
import { type VocabularyWord } from "@zoonk/ai/tasks/lessons/language/vocabulary";

export type StaticLessonStep = { text: string; title: string };

export type PracticeLessonContent = {
  kind: "practice";
  scenario: LessonPracticeSchema["scenario"];
  steps: LessonPracticeSchema["steps"];
};

export type QuizLessonContent = { kind: "quiz"; questions: QuizQuestion[] };

export type GrammarLessonContent = {
  grammarContent: LessonGrammarContentSchema;
  kind: "grammar";
  userContent: LessonGrammarUserContentSchema;
};

export type VocabularyLessonContent = { kind: "vocabulary"; words: VocabularyWord[] };

export type AlphabetLessonContent = {
  intro: LessonAlphabetSchema["intro"];
  kind: "alphabet";
  symbols: LessonAlphabetSchema["symbols"];
};

type TranslationLessonContent = { kind: "translation"; wordIds: string[] };

export type ReadingLessonContent = {
  kind: "reading";
  sentences: LessonSentencesSchema["sentences"];
};

type ListeningLessonContent = { kind: "listening"; sentenceIds: string[] };

type EmptyLessonContent = { kind: "empty" };

export type GeneratedLessonContent =
  | AlphabetLessonContent
  | EmptyLessonContent
  | GrammarLessonContent
  | ListeningLessonContent
  | PracticeLessonContent
  | QuizLessonContent
  | ReadingLessonContent
  | TranslationLessonContent
  | VocabularyLessonContent
  | { kind: "static"; steps: StaticLessonStep[] };

/**
 * Adds the local lesson kind discriminator to the generated alphabet content.
 *
 * The AI task already owns both the small symbol inventory and the learner copy,
 * so the workflow only needs a narrow conversion before enrichment and saving.
 */
export function buildAlphabetLessonContent(content: LessonAlphabetSchema): AlphabetLessonContent {
  return { ...content, kind: "alphabet" };
}
