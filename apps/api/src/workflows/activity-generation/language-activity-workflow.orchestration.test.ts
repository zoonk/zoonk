import { beforeEach, describe, expect, test, vi } from "vitest";
import { languageActivityWorkflow } from "./language-activity-workflow";
import { generateGrammarContentStep } from "./steps/generate-grammar-content-step";
import { generateReadingAudioStep } from "./steps/generate-reading-audio-step";
import { generateReadingContentStep } from "./steps/generate-reading-content-step";
import { generateVocabularyAudioStep } from "./steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "./steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationStep } from "./steps/generate-vocabulary-pronunciation-step";
import { type LessonActivity } from "./steps/get-lesson-activities-step";
import { saveActivityStep } from "./steps/save-activity-step";
import { saveReadingSentencesStep } from "./steps/save-reading-sentences-step";
import { saveVocabularyWordsStep } from "./steps/save-vocabulary-words-step";
import { updateReadingEnrichmentsStep } from "./steps/update-reading-enrichments-step";
import { updateVocabularyEnrichmentsStep } from "./steps/update-vocabulary-enrichments-step";

vi.mock("./steps/generate-vocabulary-content-step", () => ({
  generateVocabularyContentStep: vi.fn(),
}));

vi.mock("./steps/generate-grammar-content-step", () => ({
  generateGrammarContentStep: vi.fn(),
}));

vi.mock("./steps/save-vocabulary-words-step", () => ({
  saveVocabularyWordsStep: vi.fn(),
}));

vi.mock("./steps/generate-vocabulary-pronunciation-step", () => ({
  generateVocabularyPronunciationStep: vi.fn(),
}));

vi.mock("./steps/generate-vocabulary-audio-step", () => ({
  generateVocabularyAudioStep: vi.fn(),
}));

vi.mock("./steps/update-vocabulary-enrichments-step", () => ({
  updateVocabularyEnrichmentsStep: vi.fn(),
}));

vi.mock("./steps/generate-reading-content-step", () => ({
  generateReadingContentStep: vi.fn(),
}));

vi.mock("./steps/save-reading-sentences-step", () => ({
  saveReadingSentencesStep: vi.fn(),
}));

vi.mock("./steps/generate-reading-audio-step", () => ({
  generateReadingAudioStep: vi.fn(),
}));

vi.mock("./steps/update-reading-enrichments-step", () => ({
  updateReadingEnrichmentsStep: vi.fn(),
}));

vi.mock("./steps/save-activity-step", () => ({
  saveActivityStep: vi.fn(),
}));

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

describe("languageActivityWorkflow orchestration", () => {
  const activities = [] as unknown as LessonActivity[];
  const workflowRunId = "workflow-run-id";
  const saveActivityStepMock = saveActivityStep as unknown as {
    mock: {
      calls: [LessonActivity[], string, string][];
      invocationCallOrder: number[];
    };
  };
  const saveVocabularyWordsStepMock = saveVocabularyWordsStep as unknown as {
    mock: {
      invocationCallOrder: number[];
    };
  };
  const updateReadingEnrichmentsStepMock = updateReadingEnrichmentsStep as unknown as {
    mock: {
      invocationCallOrder: number[];
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateVocabularyContentStep).mockResolvedValue({ words: [] });
    vi.mocked(generateGrammarContentStep).mockResolvedValue({ generated: false });
    vi.mocked(saveVocabularyWordsStep).mockResolvedValue({ savedWords: [] });
    vi.mocked(generateVocabularyPronunciationStep).mockResolvedValue({ pronunciations: {} });
    vi.mocked(generateVocabularyAudioStep).mockResolvedValue({ audioUrls: {} });
    vi.mocked(updateVocabularyEnrichmentsStep).mockResolvedValue();
    vi.mocked(generateReadingContentStep).mockResolvedValue({ sentences: [] });
    vi.mocked(saveReadingSentencesStep).mockResolvedValue({ savedSentences: [] });
    vi.mocked(generateReadingAudioStep).mockResolvedValue({ audioUrls: {} });
    vi.mocked(updateReadingEnrichmentsStep).mockResolvedValue();
    vi.mocked(saveActivityStep).mockResolvedValue();
  });

  test("starts reading generation without waiting for vocabulary enrichment branch", async () => {
    vi.mocked(generateVocabularyContentStep).mockResolvedValue({
      words: [{ romanization: "o-la", translation: "hello", word: "hola" }],
    });

    const pendingSaveWords = deferred<{ savedWords: { word: string; wordId: number }[] }>();
    vi.mocked(saveVocabularyWordsStep).mockReturnValue(pendingSaveWords.promise);

    const runPromise = languageActivityWorkflow(activities, workflowRunId);

    await vi.waitFor(() => {
      expect(generateReadingContentStep).toHaveBeenCalledWith(activities, workflowRunId, ["hola"]);
    });

    pendingSaveWords.resolve({
      savedWords: [{ word: "hola", wordId: 1 }],
    });

    await runPromise;
  });

  test("runs grammar completion independently of reading persistence branch", async () => {
    vi.mocked(generateGrammarContentStep).mockResolvedValue({ generated: true });

    const pendingReadingContent = deferred<{
      sentences: { romanization: string; sentence: string; translation: string }[];
    }>();
    vi.mocked(generateReadingContentStep).mockReturnValue(pendingReadingContent.promise);

    const runPromise = languageActivityWorkflow(activities, workflowRunId);

    await vi.waitFor(() => {
      expect(saveActivityStep).toHaveBeenCalledWith(activities, workflowRunId, "grammar");
    });

    pendingReadingContent.resolve({ sentences: [] });
    await runPromise;
  });

  test("marks vocabulary completed only after vocabulary enrichment branch resolves", async () => {
    vi.mocked(generateVocabularyContentStep).mockResolvedValue({
      words: [{ romanization: "o-la", translation: "hello", word: "hola" }],
    });

    const pendingSaveWords = deferred<{ savedWords: { word: string; wordId: number }[] }>();
    vi.mocked(saveVocabularyWordsStep).mockReturnValue(pendingSaveWords.promise);

    const runPromise = languageActivityWorkflow(activities, workflowRunId);

    await vi.waitFor(() => {
      expect(generateReadingContentStep).toHaveBeenCalledWith(activities, workflowRunId, ["hola"]);
    });

    expect(saveActivityStep).not.toHaveBeenCalledWith(activities, workflowRunId, "vocabulary");

    pendingSaveWords.resolve({
      savedWords: [{ word: "hola", wordId: 1 }],
    });

    await runPromise;

    const vocabularyCompletionCallIndex = saveActivityStepMock.mock.calls.findIndex(
      (call) => call[2] === "vocabulary",
    );

    expect(vocabularyCompletionCallIndex).toBeGreaterThanOrEqual(0);

    const saveWordsCallOrder = saveVocabularyWordsStepMock.mock.invocationCallOrder[0];
    const vocabularyCompletionCallOrder =
      saveActivityStepMock.mock.invocationCallOrder[vocabularyCompletionCallIndex];

    expect(vocabularyCompletionCallOrder).toBeGreaterThan(saveWordsCallOrder!);
  });

  test("marks reading completed only after reading persistence branch resolves", async () => {
    vi.mocked(generateReadingContentStep).mockResolvedValue({
      sentences: [{ romanization: "o-la", sentence: "Hola", translation: "Hello" }],
    });

    const pendingSaveSentences = deferred<{
      savedSentences: { sentence: string; sentenceId: number }[];
    }>();
    vi.mocked(saveReadingSentencesStep).mockReturnValue(pendingSaveSentences.promise);

    const runPromise = languageActivityWorkflow(activities, workflowRunId);

    await vi.waitFor(() => {
      expect(saveReadingSentencesStep).toHaveBeenCalled();
    });

    expect(saveActivityStep).not.toHaveBeenCalledWith(activities, workflowRunId, "reading");

    pendingSaveSentences.resolve({
      savedSentences: [{ sentence: "Hola", sentenceId: 1 }],
    });

    await runPromise;

    const readingCompletionCallIndex = saveActivityStepMock.mock.calls.findIndex(
      (call) => call[2] === "reading",
    );

    expect(readingCompletionCallIndex).toBeGreaterThanOrEqual(0);

    const updateReadingCallOrder = updateReadingEnrichmentsStepMock.mock.invocationCallOrder[0];
    const readingCompletionCallOrder =
      saveActivityStepMock.mock.invocationCallOrder[readingCompletionCallIndex];

    expect(readingCompletionCallOrder).toBeGreaterThan(updateReadingCallOrder!);
  });

  test("does not crash the workflow when one branch rejects", async () => {
    vi.mocked(generateReadingContentStep).mockRejectedValueOnce(new Error("reading branch failed"));

    await expect(languageActivityWorkflow(activities, workflowRunId)).resolves.toBeUndefined();
  });
});
