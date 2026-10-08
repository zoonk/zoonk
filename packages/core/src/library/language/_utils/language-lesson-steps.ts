import { type LanguageLessonContent } from "@zoonk/ai/tasks/v2/language/language-lesson";
import { type StepKind } from "@zoonk/db";
import { safeParseStepContent } from "../../steps/contract/step-contract";

/** One language screen before positions and provenance are added. */
export type LanguageStepToSave = {
  kind: StepKind;
  content: object;
  wordId: string | null;
  sentenceId: string | null;
};

type LanguageLessonStepsInput = {
  content: LanguageLessonContent;
  /** The shared `Sentence` row of each sentence, in the content's order. */
  sentenceIds: readonly string[];
  targetLanguage: string;
  /** The shared `Word` row of each word, in the content's order. */
  wordIds: readonly string[];
};

/** Saying a sentence out loud is the most tiring screen, so a lesson asks for two at most. */
const MAX_SPOKEN_STEPS = 2;

function step(kind: StepKind, content: object, ids: Partial<LanguageStepToSave> = {}) {
  return { content, kind, sentenceId: ids.sentenceId ?? null, wordId: ids.wordId ?? null };
}

/** Recognizing words in the same order they were taught tests memory of the order, not the words. */
function rotate<TItem>(items: readonly TItem[]): TItem[] {
  return [...items.slice(1), ...items.slice(0, 1)];
}

function getTipText(tip: LanguageLessonContent["tip"]): string {
  const examples = tip.examples.map(
    (example) => `- \`${example.sentence}\`: ${example.translation}`,
  );

  return [tip.text, examples.join("\n")].filter(Boolean).join("\n\n");
}

function getSentenceSteps({ content, sentenceIds, targetLanguage }: LanguageLessonStepsInput) {
  const sentences = content.sentences.map((sentence, index) => ({
    ...sentence,
    sentenceId: sentenceIds[index] ?? null,
  }));

  const readingCount = Math.ceil(sentences.length / 2);

  const reading = sentences
    .slice(0, readingCount)
    .map((sentence) => step("reading", {}, { sentenceId: sentence.sentenceId }));

  const listening = sentences
    .slice(readingCount)
    .map((sentence) => step("listening", {}, { sentenceId: sentence.sentenceId }));

  const speaking = sentences
    .flatMap((sentence) =>
      sentence.speakingPrompt ? [{ ...sentence, prompt: sentence.speakingPrompt }] : [],
    )
    .slice(0, MAX_SPOKEN_STEPS)
    .map((sentence) =>
      step(
        "spokenAnswer",
        {
          language: targetLanguage,
          prompt: sentence.prompt,
          targetText: sentence.sentence,
          translation: sentence.translation,
          ...(sentence.romanization ? { romanization: sentence.romanization } : {}),
        },
        { sentenceId: sentence.sentenceId },
      ),
    );

  return { listening, reading, speaking };
}

function getWritingStep(writing: LanguageLessonContent["writing"]) {
  const [sampleAnswer] = writing.answers;

  if (!sampleAnswer) {
    return [];
  }

  return [
    step("typedAnswer", {
      acceptedAnswers: writing.answers,
      keyPoints: writing.keyPoints,
      question: writing.prompt,
      sampleAnswer,
    }),
  ];
}

function getPracticeSteps(practice: LanguageLessonContent["practice"]) {
  return practice.map((item) =>
    step("fillBlank", {
      answers: [item.answer],
      distractors: item.distractors,
      feedback: item.feedback,
      template: item.template,
      ...(item.question ? { question: item.question } : {}),
    }),
  );
}

/**
 * Lays a language lesson out in the session rhythm: meet each new word,
 * recognize it, read the tip, practice the pattern, build sentences, listen,
 * say one or two out loud, write one, and finish with the summary. Word and
 * sentence screens only reference their shared rows; the pair's translations
 * live on the lesson's word and sentence links. A screen that doesn't fit the
 * step contract (too long for a phone) is left out rather than stored broken.
 */
export function buildLanguageLessonSteps(input: LanguageLessonStepsInput): LanguageStepToSave[] {
  const { content, wordIds } = input;
  const wordStepIds = wordIds.map((wordId) => ({ wordId }));
  const sentenceSteps = getSentenceSteps(input);

  const steps = [
    ...wordStepIds.map((ids) => step("vocabulary", {}, ids)),
    ...rotate(wordStepIds).map((ids) => step("translation", {}, ids)),
    step("explanation", { text: getTipText(content.tip), title: content.tip.title }),
    ...getPracticeSteps(content.practice),
    ...sentenceSteps.reading,
    ...sentenceSteps.listening,
    ...sentenceSteps.speaking,
    ...getWritingStep(content.writing),
    step("summary", { ideas: content.summary.map((text) => ({ text })) }),
  ];

  return steps.flatMap((candidate) => {
    const parsed = safeParseStepContent(candidate.kind, candidate.content);
    return parsed.success ? [{ ...candidate, content: parsed.data }] : [];
  });
}
