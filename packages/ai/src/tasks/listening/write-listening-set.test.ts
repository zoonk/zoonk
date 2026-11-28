import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { writeListeningSet } from "./write-listening-set";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./write-listening-set.prompt.md", () => ({
  default: "Script in {{TARGET_LANGUAGE}}, feedback in {{LEARNER_LANGUAGE}}.",
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

describe(writeListeningSet, () => {
  it("names the recording's language plainly and the learner's language", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("stop"));

    await expect(
      writeListeningSet(
        {
          accents: ["British English"],
          count: 4,
          exam: "IELTS",
          formats: ["multipleChoice"],
          language: "pt",
          level: null,
          plays: 1,
          scriptLanguage: "en",
          skills: [{ description: "A detail", name: "Detail" }],
          task: "Part 1",
          useFallback: false,
        },
        false,
      ),
    ).rejects.toThrow("stop");

    expect(vi.mocked(generateText).mock.calls[0]?.[0].instructions).toBe(
      "Script in English, feedback in Português Brasileiro.",
    );
  });
});
