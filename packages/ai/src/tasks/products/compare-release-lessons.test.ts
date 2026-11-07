import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerEmptyOnce } from "../_test-utils/answer-once-with";
import { compareReleaseLessons } from "./compare-release-lessons";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./compare-release-lessons.prompt.md", () => ({ default: "" }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const MODEL = "openai/gpt-6.1-terra";

const LESSON = { canDo: "Export a file", ideas: ["File, then Export"], title: "Export" };

const WHATS_NEW = {
  level: "beginner" as const,
  offer: "Learn the new sync panel — in two lessons",
  skills: [
    { description: "Turn sync on.", name: "**Sync** your notes" },
    { description: "Same skill again.", name: "sync your notes" },
  ],
  title: "What's new in version 8",
};

function answer(output: unknown) {
  const usage = {
    inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 100 },
    inputTokens: 100,
    outputTokenDetails: { reasoningTokens: 0, textTokens: 50 },
    outputTokens: 50,
    totalTokens: 150,
  };

  const step = {
    model: { modelId: MODEL, provider: "gateway" },
    providerMetadata: {},
    response: { modelId: MODEL },
    usage,
  };

  return { finalStep: step, output, steps: [step], usage };
}

const PARAMS = {
  from: "Version 7",
  language: "en",
  lessons: [LESSON, LESSON, LESSON],
  product: "Test App",
  releaseNotes: "Version 8 moves export to a panel.",
  to: "Version 8",
};

function compare(output: unknown) {
  vi.mocked(generateText).mockResolvedValue(answer(output) as never);
  return compareReleaseLessons(PARAMS);
}

describe(compareReleaseLessons, () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it("keeps only lessons that exist, each once", async () => {
    const { data } = await compare({
      changed: [
        { change: "Renamed.", lesson: 2 },
        { change: "Again.", lesson: 2 },
        { change: "Out of range.", lesson: 4 },
        { change: "Zero.", lesson: 0 },
      ],
      whatsNew: null,
    });

    expect(data).toStrictEqual({ changed: [{ change: "Renamed.", lesson: 2 }], whatsNew: null });
  });

  it("repairs text flaws and merges a skill written twice", async () => {
    const { data } = await compare({ changed: [], whatsNew: WHATS_NEW });

    expect(data.whatsNew).toStrictEqual({
      ...WHATS_NEW,
      offer: "Learn the new sync panel, in two lessons",
      skills: [{ description: "Turn sync on.", name: "Sync your notes" }],
    });
  });

  it("drops a chapter with no skills to teach", async () => {
    const { data } = await compare({
      changed: [],
      whatsNew: { ...WHATS_NEW, skills: [{ description: "", name: " " }] },
    });

    expect(data.whatsNew).toBeNull();
  });

  it("fails an empty answer the provider's filter stopped as a comparison the schema can't accept", async () => {
    await answerEmptyOnce("content-filter");

    await expect(compareReleaseLessons(PARAMS)).rejects.toMatchObject({
      finishReason: "content-filter",
      name: "AI_NoObjectGeneratedError",
    });
  });

  it("leaves an empty answer for any other reason as missing output, which a retry can fix", async () => {
    await answerEmptyOnce("error");

    await expect(compareReleaseLessons(PARAMS)).rejects.toMatchObject({
      name: "AI_NoOutputGeneratedError",
    });
  });
});
