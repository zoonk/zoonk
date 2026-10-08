import { generateLanguageLesson } from "@zoonk/ai/tasks/v2/language/language-lesson";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { wordFixture, wordPronunciationFixture } from "@zoonk/testing/fixtures/words";
import { describe, expect, it, vi } from "vitest";
import { generateLanguageAudio } from "../../audio/generate-language-audio";
import { claimLibraryGeneration } from "../claims/generation-claim";
import { STEP_CONTRACT_VERSION, parseStepContent } from "../steps/contract/step-contract";
import { languageLessonDraft } from "./_test-utils/language-lesson-draft";
import { writeLanguageLessonContent } from "./write-language-lesson-content";

// The writer and text-to-speech (with its upload) are paid external services.
vi.mock("@zoonk/ai/tasks/v2/language/language-lesson", () => ({ generateLanguageLesson: vi.fn() }));
vi.mock("../../audio/generate-language-audio", () => ({ generateLanguageAudio: vi.fn() }));

type Draft = ReturnType<typeof languageLessonDraft>;

function linksOf(lessonId: string) {
  return prisma.lessonWord.findMany({ orderBy: { position: "asc" }, where: { lessonId } });
}

/**
 * Each test uses its own words, so shared rows (one per target language and
 * text) from other tests never make audio or pronunciations look reused.
 */
function uniqueDraft(key: string): Draft {
  const draft = languageLessonDraft();
  const suffix = (text: string) => `${text} ${key}`;

  return {
    ...draft,
    sentences: draft.sentences.map((sentence) => ({
      ...sentence,
      sentence: suffix(sentence.sentence),
    })),
    words: draft.words.map((word) => ({
      ...word,
      distractors: word.distractors.map(suffix),
      word: suffix(word.word),
    })),
  };
}

function mockDraft(draft: Draft, runId: string = crypto.randomUUID()) {
  vi.mocked(generateLanguageLesson).mockResolvedValueOnce({
    data: draft,
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-sol",
      promptVersion: "test-prompt",
      provider: "openai",
      requestedModel: "openai/gpt-6-sol",
      runId,
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

const SPEECH_PROVENANCE = {
  generatedAt: new Date().toISOString(),
  model: "google/gemini-3.8-flash-tts",
  promptVersion: "speech-v1",
  runId: "speech-run",
} as const;

function mockAudio() {
  vi.mocked(generateLanguageAudio).mockImplementation(async ({ text }) => ({
    data: {
      provenance: SPEECH_PROVENANCE,
      url: `https://blob.test/audio/${encodeURIComponent(text)}.mp3`,
    },
    error: null,
  }));
}

async function claimLanguageLesson(attrs: { language: string; chapterId?: string }) {
  const lesson = await libraryLessonFixture({
    canDo: "Ask how much the rent is",
    description: "Ask about the rent and the deposit",
    language: attrs.language,
    targetLanguage: "en",
    title: "Asking about the rent",
    ...(attrs.chapterId ? { homeChapterId: attrs.chapterId } : {}),
  });

  const workflowRunId = crypto.randomUUID();
  await claimLibraryGeneration({ id: lesson.id, target: "lessonContent", workflowRunId });

  return { lesson, workflowRunId };
}

describe(writeLanguageLessonContent, () => {
  it("writes nothing for a run that doesn't hold the claim", async () => {
    const lesson = await libraryLessonFixture({ language: "pt", targetLanguage: "en" });

    await expect(
      writeLanguageLessonContent({ lessonId: lesson.id, workflowRunId: crypto.randomUUID() }),
    ).resolves.toStrictEqual({ status: "notClaimed" });

    expect(generateLanguageLesson).not.toHaveBeenCalled();
  });

  it("publishes the lesson with its pair's words, sentences, screens and summary", async () => {
    await aiOrganizationFixture();
    const key = crypto.randomUUID();

    const [chapter, skill] = await Promise.all([
      libraryChapterFixture({
        language: "pt",
        objectives: ["Alugar um apartamento"],
        targetLanguage: "en",
        title: "Alugando um apartamento",
      }),
      skillFixture(),
    ]);

    const { lesson, workflowRunId } = await claimLanguageLesson({
      chapterId: chapter.id,
      language: "pt",
    });

    await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });

    const writerRunId = crypto.randomUUID();
    mockDraft(uniqueDraft(key), writerRunId);
    mockAudio();

    const result = await writeLanguageLessonContent({ lessonId: lesson.id, workflowRunId });

    expect(result).toStrictEqual({
      sentenceCount: 3,
      status: "published",
      stepCount: 15,
      wordCount: 3,
    });

    expect(vi.mocked(generateLanguageLesson).mock.calls[0]?.[0]).toMatchObject({
      learnerLanguage: "pt",
      lessonCanDo: "Ask how much the rent is",
      level: "A1–A2",
      targetLanguage: "en",
      unitCanDos: ["Alugar um apartamento"],
      unitTitle: "Alugando um apartamento",
    });

    const saved = await prisma.lesson.findUniqueOrThrow({
      include: {
        sentences: { include: { sentence: true }, orderBy: { position: "asc" } },
        steps: { orderBy: { position: "asc" } },
        words: {
          include: { word: { include: { pronunciations: true } } },
          orderBy: { position: "asc" },
        },
      },
      where: { id: lesson.id },
    });

    expect(saved.contentStatus).toBe("completed");

    expect(saved.summary).toStrictEqual({
      ideas: [
        { text: "'How much is the rent?' pergunta o valor do aluguel." },
        { text: "'Deposit' é a caução." },
      ],
    });

    expect(saved.words[0]).toMatchObject({
      distractors: [`income ${key}`, `salary ${key}`],
      model: "openai/gpt-6-sol",
      note: "Em português, 'renda' é o que você ganha; 'rent' é o aluguel.",
      translation: "o aluguel",
    });

    // Shared words keep the lesson run that wrote them and the speech run that voiced them.
    expect(saved.words[0]?.word).toMatchObject({
      audioModel: SPEECH_PROVENANCE.model,
      audioPromptVersion: SPEECH_PROVENANCE.promptVersion,
      audioRunId: SPEECH_PROVENANCE.runId,
      audioUrl: expect.stringContaining("blob.test"),
      model: "openai/gpt-6-sol",
      promptVersion: "test-prompt",
      runId: writerRunId,
      targetLanguage: "en",
    });

    expect(saved.sentences[0]?.sentence).toMatchObject({
      audioRunId: SPEECH_PROVENANCE.runId,
      model: "openai/gpt-6-sol",
      runId: writerRunId,
    });

    expect(saved.words[0]?.word.pronunciations).toMatchObject([
      {
        model: "openai/gpt-6-sol",
        pronunciation: "RÉNT",
        runId: writerRunId,
        tip: expect.stringContaining("curve a língua"),
        userLanguage: "pt",
      },
    ]);

    expect(saved.sentences.map((row) => [row.sentence.sentence, row.translation])).toStrictEqual([
      [`How much is the rent? ${key}`, "Quanto é o aluguel?"],
      [`Is there a deposit? ${key}`, "Tem caução?"],
      [`Utilities are included ${key}`, "As contas estão incluídas"],
    ]);

    expect(saved.steps.every((step) => step.skillId === skill.id)).toBe(true);

    for (const { content, contractVersion, kind } of saved.steps) {
      expect(() => parseStepContent(kind, content)).not.toThrow();
      expect(contractVersion).toBe(STEP_CONTRACT_VERSION);
    }

    const distractorWord = await prisma.word.findFirstOrThrow({ where: { word: `income ${key}` } });
    expect(distractorWord.audioUrl).toContain("blob.test");
  });

  it("reuses the target language's words, sentences and audio for another language pair", async () => {
    const organization = await aiOrganizationFixture();
    const key = crypto.randomUUID();
    const draft = uniqueDraft(key);
    const rentText = draft.words[0]!.word;

    const voicedRent = await wordFixture({
      audioUrl: "https://blob.test/already-voiced.mp3",
      organizationId: organization.id,
      targetLanguage: "en",
      word: rentText,
    });

    await wordPronunciationFixture({
      pronunciation: "REHNT",
      userLanguage: "pt",
      wordId: voicedRent.id,
    });

    const forPortuguese = await claimLanguageLesson({ language: "pt" });
    const forSpanish = await claimLanguageLesson({ language: "es" });

    mockDraft(draft);
    mockAudio();

    await writeLanguageLessonContent({
      lessonId: forPortuguese.lesson.id,
      workflowRunId: forPortuguese.workflowRunId,
    });

    const firstLessonClips = vi.mocked(generateLanguageAudio).mock.calls.map(([call]) => call.text);

    mockDraft({
      ...draft,
      words: draft.words.map((word) => ({ ...word, pronunciation: `es ${word.pronunciation}` })),
    });

    await writeLanguageLessonContent({
      lessonId: forSpanish.lesson.id,
      workflowRunId: forSpanish.workflowRunId,
    });

    const allClips = vi.mocked(generateLanguageAudio).mock.calls.map(([call]) => call.text);

    // The word voiced before was never sent to text-to-speech, and the second pair voiced nothing new.
    expect(firstLessonClips).not.toContain(rentText);
    expect(allClips).toStrictEqual(firstLessonClips);

    const [portugueseLinks, spanishLinks] = await Promise.all([
      linksOf(forPortuguese.lesson.id),
      linksOf(forSpanish.lesson.id),
    ]);

    expect(spanishLinks.map((link) => link.wordId)).toStrictEqual(
      portugueseLinks.map((link) => link.wordId),
    );

    expect(portugueseLinks[0]?.wordId).toBe(voicedRent.id);

    const pronunciations = await prisma.wordPronunciation.findMany({
      orderBy: { userLanguage: "asc" },
      where: { wordId: voicedRent.id },
    });

    // The existing respelling stays; its missing tip is filled; Spanish speakers get their own.
    expect(
      pronunciations.map((row) => [row.userLanguage, row.pronunciation, Boolean(row.tip)]),
    ).toStrictEqual([
      ["es", "es RÉNT", true],
      ["pt", "REHNT", true],
    ]);
  });

  it("doesn't teach words the unit's earlier lessons taught", async () => {
    await aiOrganizationFixture();
    const key = crypto.randomUUID();
    const draft = uniqueDraft(key);
    const chapter = await libraryChapterFixture({ language: "pt", targetLanguage: "en" });

    const earlier = await claimLanguageLesson({ chapterId: chapter.id, language: "pt" });
    await chapterLessonFixture({ chapterId: chapter.id, lessonId: earlier.lesson.id, position: 0 });
    mockDraft({ ...draft, words: draft.words.slice(0, 1) });
    mockAudio();

    await writeLanguageLessonContent({
      lessonId: earlier.lesson.id,
      workflowRunId: earlier.workflowRunId,
    });

    const later = await claimLanguageLesson({ chapterId: chapter.id, language: "pt" });
    await chapterLessonFixture({ chapterId: chapter.id, lessonId: later.lesson.id, position: 1 });
    mockDraft(draft);

    await writeLanguageLessonContent({
      lessonId: later.lesson.id,
      workflowRunId: later.workflowRunId,
    });

    expect(vi.mocked(generateLanguageLesson).mock.calls[1]?.[0].knownWords).toStrictEqual([
      draft.words[0]!.word,
    ]);

    const laterWords = await prisma.lessonWord.findMany({
      include: { word: true },
      where: { lessonId: later.lesson.id },
    });

    expect(laterWords.map((row) => row.word.word)).not.toContain(draft.words[0]!.word);
  });

  it("holds back a draft with too few sentences and ends the claim as failed", async () => {
    await aiOrganizationFixture();
    const { lesson, workflowRunId } = await claimLanguageLesson({ language: "pt" });
    const draft = uniqueDraft(crypto.randomUUID());

    mockDraft({ ...draft, sentences: draft.sentences.slice(0, 1) });

    await expect(
      writeLanguageLessonContent({ lessonId: lesson.id, workflowRunId }),
    ).resolves.toStrictEqual({ status: "heldBack" });

    const saved = await prisma.lesson.findUniqueOrThrow({
      include: { steps: true },
      where: { id: lesson.id },
    });

    expect(saved.contentStatus).toBe("failed");
    expect(saved.steps).toHaveLength(0);
  });
});
