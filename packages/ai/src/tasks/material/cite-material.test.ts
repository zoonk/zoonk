import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { citeMaterial } from "./cite-material";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./cite-material.prompt.md", () => ({ default: "Cite each screen." }));
vi.mock("./cite-material-own-material.prompt.md", () => ({ default: "Notes rule." }));
vi.mock("./cite-material-official.prompt.md", () => ({ default: "Official rule." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const input = {
  material: '<page ref="S1:1" of="Slides">Osmosis</page>',
  screens: ["Water moves to the saltier side."],
};

describe(citeMaterial, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ citations: [{ ref: "S1:1", screen: 1 }] }),
    );
  });

  it("sends the rule about a learner's own notes only for their material", async () => {
    const { systemPrompt } = await citeMaterial({ ...input, documents: "material" });

    expect(systemPrompt).toBe("Cite each screen.\nNotes rule.");
    expect(vi.mocked(generateText).mock.calls[0]?.[0].instructions).toBe(systemPrompt);
  });

  it("sends the rule about official documents only for the sources a lesson's facts come from", async () => {
    const { systemPrompt } = await citeMaterial({ ...input, documents: "sources" });

    expect(systemPrompt).toBe("Cite each screen.\nOfficial rule.");
    expect(vi.mocked(generateText).mock.calls[0]?.[0].instructions).toBe(systemPrompt);
  });
});
