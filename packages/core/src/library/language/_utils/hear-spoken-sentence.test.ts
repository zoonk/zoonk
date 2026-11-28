import { assessPronunciation } from "@zoonk/ai/tasks/language/assess-pronunciation";
import {
  NO_SPEECH_CHECK_MODEL,
  transcribeSpeech,
} from "@zoonk/ai/tasks/language/transcribe-speech";
import { describe, expect, it, vi } from "vitest";
import { matchSpokenAnswer } from "../spoken-answer-match";
import { hearSpokenSentence } from "./hear-spoken-sentence";

vi.mock("@zoonk/ai/tasks/language/assess-pronunciation");
vi.mock("@zoonk/ai/tasks/language/transcribe-speech");

const recording = {
  audio: { bytes: new Uint8Array(), mediaType: "audio/webm" },
  userId: "speaker",
};

function transcribe(text: string) {
  vi.mocked(transcribeSpeech).mockResolvedValueOnce({ data: { text } } as Awaited<
    ReturnType<typeof transcribeSpeech>
  >);
}

/** The no-speech check's model answers `second`; any other call answers `first`. */
function transcribers({ first, second }: { first: string | Error; second?: string | Error }) {
  vi.mocked(transcribeSpeech).mockImplementation(async ({ model }) => {
    const text = model === NO_SPEECH_CHECK_MODEL ? second : first;

    if (text === undefined) {
      throw new Error(`No transcript for ${model}`);
    }

    if (text instanceof Error) {
      throw text;
    }

    return { data: { text } } as Awaited<ReturnType<typeof transcribeSpeech>>;
  });
}

function verdict(text: string, correct: boolean) {
  vi.mocked(assessPronunciation).mockResolvedValueOnce({
    data: {
      transcript: text,
      words: [{ heard: null, issue: null, status: correct ? "correct" : "different", text }],
    },
  } as Awaited<ReturnType<typeof assessPronunciation>>);
}

describe(hearSpokenSentence, () => {
  it.each([
    ["zh", "我叫林芳", "我叫林方", "Wǒ jiào Lín Fāng"],
    ["sr", "Људи пију чај.", "Ljudi piju čaj.", undefined],
    ["ja", "なつきです。", "ナツキです。", undefined],
  ])(
    "accepts the same recorded reading in %s and preserves the transcript",
    async (language, expected, heard, romanization) => {
      transcribe(heard);
      const result = await hearSpokenSentence({ ...recording, expected, language, romanization });
      expect(result.transcript).toBe(heard);
      expect(result.match).toMatchObject({ isCorrect: true, score: 1 });

      expect(
        result.match.words.every((word) => word.status === "correct" && word.heard === null),
      ).toBe(true);

      expect(assessPronunciation).not.toHaveBeenCalled();
      expect(matchSpokenAnswer({ expected, heard, language }).isCorrect).toBe(false);
    },
  );

  it.each([
    ["it", "Ha fratelli?", "Ah, fratelli.", undefined],
    ["de", "Er isst viel.", "Er ist viel.", undefined],
    ["fr", "Elle a un verre.", "Et l'inverse.", undefined],
    ["fr-CA", "Ils parlent.", "Il parle.", undefined],
    ["nl", "Lijden.", "Leiden.", undefined],
    ["es", "Hola.", "Ola.", undefined],
    ["es", "Hola", "Hora", undefined],
    ["cs", "Být", "Byt", undefined],
    ["ru", "Это мой код.", "Это мой кот.", undefined],
    ["it", "Emma si scrive: e, emme, emme, a", "Emma si scrive E, M, M, A.", undefined],
    ["en", "Did you say 312?", "Did you say three one two?", undefined],
    ["en", "Is it a ten-minute walk?", "Is it a ten minute walk?", undefined],
    ["sr", "инјекција", "injekcija", undefined],
    ["sr", "инјекција", "ињекција", undefined],
    ["ja", "今日は雨です。", "は雨です。", undefined],
    ["ja", "きって", "きて", undefined],
    ["ja", "「住所」をよむ", "じゅうしょをよむ", undefined],
    ["ko", "타이브레이크", "타이 브레이크", undefined],
    ["yue", "王明", "汪明", "Wáng Míng"],
    ["zh", "林芳", "林方", undefined],
    ["zh", "我有三个哥哥", "我有3个哥哥", "Wǒ yǒu sān gè gēge"],
    ["zh", "李安", "里安", "Lǐ’ān"],
    ["zh", "她叫李娜", "她叫里娜", "Tā jiào Lǐ Nà"],
    ["zh", "航", "行", "háng"],
    ["zh", "李安", "里安", "Lǐān"],
    ["zh", "我叫善平", "我叫单平", "Wǒ jiào Shàn Píng"],
  ])(
    "lets the recording decide a %s transcript that differs from the sentence",
    async (language, expected, heard, romanization) => {
      transcribe(heard);
      verdict(expected, true);
      const result = await hearSpokenSentence({ ...recording, expected, language, romanization });

      expect(assessPronunciation).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ expectedText: expected, transcriberHeard: heard }),
      );

      expect(result.match.isCorrect).toBe(true);
    },
  );

  it.each([
    ["zh", "王明", "汪明", "Wáng Míng"],
    ["zh", "王明", "王民", "Wáng Míng"],
  ])(
    "trusts a transcript with other Mandarin tones (%s %s)",
    async (language, expected, heard, romanization) => {
      transcribe(heard);
      const result = await hearSpokenSentence({ ...recording, expected, language, romanization });
      expect(result.match.isCorrect).toBe(false);
      expect(assessPronunciation).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    "uses the recording when only the opening word is missing from the transcript (said: %s)",
    async (said) => {
      const expected = "Ho tempo.";
      const transcript = said ? expected : "Tempo.";
      transcribe("Tempo.");

      vi.mocked(assessPronunciation).mockResolvedValueOnce({
        data: {
          transcript,
          words: [
            { heard: null, issue: null, status: said ? "correct" : "missed", text: "Ho" },
            { heard: null, issue: null, status: "correct", text: "tempo." },
          ],
        },
      } as Awaited<ReturnType<typeof assessPronunciation>>);

      const result = await hearSpokenSentence({ ...recording, expected, language: "it" });

      expect(assessPronunciation).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ audio: recording.audio.bytes, expectedText: expected }),
      );

      expect(result.transcript).toBe(transcript);
      expect(result.match.isCorrect).toBe(said);
    },
  );

  it.each([true, false])(
    "grades the authored surname reading from the audio (%s)",
    async (correct) => {
      const expected = "我姓单";
      const romanization = "Wǒ xìng Shàn";
      transcribers({ first: expected });
      verdict(expected, correct);

      const result = await hearSpokenSentence({
        ...recording,
        expected,
        language: "zh",
        romanization,
      });

      expect(result.match.isCorrect).toBe(correct);

      expect(assessPronunciation).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ romanization }),
      );
    },
  );

  it("does not award an ambiguous surname on spelling alone during an audio checker outage", async () => {
    vi.mocked(assessPronunciation).mockRejectedValueOnce(new Error("audio unavailable"));
    transcribe("我姓單");

    await expect(
      hearSpokenSentence({
        ...recording,
        expected: "我姓单",
        language: "zh",
        romanization: "Wǒ xìng Shàn",
      }),
    ).rejects.toThrow("audio unavailable");

    expect(assessPronunciation).toHaveBeenCalledOnce();
  });

  it("keeps an audible mistake when two spellings could sound alike", async () => {
    transcribe("Il parle.");
    verdict("Ils parlent.", false);

    const result = await hearSpokenSentence({
      ...recording,
      expected: "Ils parlent.",
      language: "fr",
    });

    expect(result.match.isCorrect).toBe(false);
    expect(assessPronunciation).toHaveBeenCalledOnce();
  });

  it.each(["fast", "thorough"] as const)(
    "hears no speech when both transcribers hear no words, whatever the judge says (%s)",
    async (check) => {
      transcribers({ first: "", second: "" });
      verdict("obrigado", true);

      const result = await hearSpokenSentence({
        ...recording,
        check,
        expected: "obrigado",
        language: "pt",
      });

      expect(result.transcript).toBe("");
      expect(result.match).toMatchObject({ isCorrect: false, normalizedHeard: "" });
    },
  );

  it.each(["fast", "thorough"] as const)(
    "lets the judge grade a short word only the no-speech check heard (%s)",
    async (check) => {
      transcribers({ first: "", second: "mam" });
      verdict("vin", true);

      const result = await hearSpokenSentence({
        ...recording,
        check,
        expected: "vin",
        language: "fr",
      });

      expect(assessPronunciation).toHaveBeenCalledExactlyOnceWith(
        expect.not.objectContaining({ transcriberHeard: expect.anything() }),
      );

      expect(result.match.isCorrect).toBe(true);
    },
  );

  it("hears no speech when the transcriber fails and the no-speech check hears no words", async () => {
    transcribers({ first: new Error("language not supported"), second: "" });
    verdict("Dia duit", true);

    const result = await hearSpokenSentence({ ...recording, expected: "Dia duit", language: "ga" });

    expect(result.match).toMatchObject({ isCorrect: false, normalizedHeard: "" });
    expect(assessPronunciation).not.toHaveBeenCalled();
  });

  it("hears no speech when the transcriber hears no words and the no-speech check fails", async () => {
    transcribers({ first: "", second: new Error("unavailable") });

    const result = await hearSpokenSentence({
      ...recording,
      expected: "Take the bus",
      language: "en",
    });

    expect(result.match).toMatchObject({ isCorrect: false, normalizedHeard: "" });
    expect(assessPronunciation).not.toHaveBeenCalled();
  });

  it("lets the judge grade when both transcribers fail", async () => {
    transcribers({ first: new Error("unavailable"), second: new Error("unavailable") });
    verdict("Take the bus", true);

    const result = await hearSpokenSentence({
      ...recording,
      expected: "Take the bus",
      language: "en",
    });

    expect(result.match.isCorrect).toBe(true);
  });
});
