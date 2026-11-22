import { assessPronunciation } from "@zoonk/ai/tasks/language/assess-pronunciation";
import { transcribeSpeech } from "@zoonk/ai/tasks/language/transcribe-speech";
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
    ["sr", "инјекција", "injekcija", undefined],
    ["zh", "李安", "里安", "Lǐ’ān"],
    ["zh", "她叫李娜", "她叫里娜", "Tā jiào Lǐ Nà"],
    ["fr-CA", "Ils parlent.", "Il parle.", undefined],
    ["nl", "Lijden.", "Leiden.", undefined],
    ["es", "Hola.", "Ola.", undefined],
    ["ko", "타이브레이크", "타이 브레이크", undefined],
    ["ja", "「住所」をよむ", "じゅうしょをよむ", undefined],
  ])(
    "lets the audio resolve a possible %s reading",
    async (language, expected, heard, romanization) => {
      transcribe(heard);
      verdict(expected, true);
      const result = await hearSpokenSentence({ ...recording, expected, language, romanization });

      expect(assessPronunciation).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ expectedText: expected }),
      );

      expect(result.match.isCorrect).toBe(true);
    },
  );

  it.each([
    ["zh", "李安", "里安", "Lǐān"],
    ["en", "我叫王明", "我叫王民", undefined],
    ["zh", "王明", "汪明", "Wáng Míng"],
    ["zh", "王明", "王民", "Wáng Míng"],
    ["zh", "林芳", "林方", undefined],
    ["yue", "王明", "汪明", "Wáng Míng"],
    ["es", "Hola", "Hora", undefined],
    ["cs", "Být", "Byt", undefined],
    ["sr", "инјекција", "ињекција", undefined],
    ["ja", "きって", "きて", undefined],
    ["en", "Take the bus", "", undefined],
  ])(
    "preserves a distinct or unconfirmed %s reading",
    async (language, expected, heard, romanization) => {
      transcribe(heard);
      const result = await hearSpokenSentence({ ...recording, expected, language, romanization });
      expect(result.match.isCorrect).toBe(false);
      expect(assessPronunciation).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    "grades the authored surname reading from the audio (%s)",
    async (correct) => {
      const expected = "我姓单";
      const romanization = "Wǒ xìng Shàn";
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

      expect(transcribeSpeech).not.toHaveBeenCalled();
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
});
