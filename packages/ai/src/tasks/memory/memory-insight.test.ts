import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type MemoryInsightParams, generateMemoryInsight } from "./memory-insight";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./memory-insight.prompt.md", () => ({ default: "Coach the learner." }));
vi.mock("./memory-insight-plan-change.prompt.md", () => ({ default: "Size plan changes." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const NO_INSIGHT = { kind: "none", lessonFocus: null, message: null, skill: null, studyTime: null };

const FRACTIONS = {
  chapter: null,
  covers: ["Fractions as percentages"],
  lessons: 1,
  name: "Fractions",
  prepares: "Percentages",
};

function insightParams(params: Partial<MemoryInsightParams>): MemoryInsightParams {
  return {
    facts: [],
    goal: "ENEM 2026",
    kinds: ["tip", "scheduleIdea"],
    language: "en",
    recentInsights: [],
    signals: "Answers in the last 7 days: 60 on 5 days, 70% right.",
    skills: [],
    studyTime: null,
    ...params,
  };
}

describe(generateMemoryInsight, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult(NO_INSIGHT));
  });

  it("sends the plan change rules and the gaps only on a day that allows a plan change", async () => {
    const withGap = await generateMemoryInsight(
      insightParams({ kinds: ["tip", "planChange", "scheduleIdea"], skills: [FRACTIONS] }),
    );

    expect(withGap.systemPrompt).toBe("Coach the learner.\nSize plan changes.");
    expect(withGap.userPrompt).toContain('name="SKILLS"');
    expect(withGap.userPrompt).toContain("Fractions: 1 short lesson");

    const withoutGap = await generateMemoryInsight(insightParams({}));

    expect(withoutGap.systemPrompt).toBe("Coach the learner.");
    expect(withoutGap.userPrompt).not.toContain("SKILLS");
    expect(vi.mocked(generateText).mock.lastCall?.[0].instructions).toBe("Coach the learner.");
  });
});
