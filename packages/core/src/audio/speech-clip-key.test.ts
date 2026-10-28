import { getLanguageAudioPrompt } from "@zoonk/ai/tasks/audio/prompt";
import { describe, expect, it, vi } from "vitest";
import { getSpeechClipKey } from "./speech-clip-key";

vi.mock("@zoonk/ai/tasks/audio/prompt", () => ({ getLanguageAudioPrompt: vi.fn() }));

describe(getSpeechClipKey, () => {
  it("keys a clip by its language and words, whatever instructions the voice has now", () => {
    vi.mocked(getLanguageAudioPrompt).mockReturnValue({
      instructions: "Read it",
      promptVersion: "1",
    });

    const before = getSpeechClipKey({ language: "it", text: "Ciao, come stai?" });

    vi.mocked(getLanguageAudioPrompt).mockReturnValue({
      instructions: "Slower",
      promptVersion: "2",
    });

    expect(getSpeechClipKey({ language: "it", text: "Ciao,  come stai?" })).toBe(before);
    expect(getSpeechClipKey({ language: "pt", text: "Ciao, come stai?" })).not.toBe(before);
  });
});
