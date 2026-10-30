import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { findTargetCutoff } from "./find-target-cutoff";
import type * as SearchTools from "./research-search-tools";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./find-target-cutoff.prompt.md", () => ({ default: "Find the cut-off." }));
vi.mock("./find-target-cutoff-course.prompt.md", () => ({ default: "Course target." }));
vi.mock("./find-target-cutoff-position.prompt.md", () => ({ default: "Position target." }));

vi.mock("./research-search-tools", async (importOriginal) => ({
  ...(await importOriginal<typeof SearchTools>()),
  buildResearchSearchTools: vi.fn(() => ({})),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const UNKNOWN = {
  edition: null,
  maxScore: null,
  quota: null,
  score: null,
  sourceTitle: null,
  sourceUrl: null,
  status: "unknown",
};

describe(findTargetCutoff, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult(UNKNOWN));
  });

  it("asks about a course at an institution with the course rules only", async () => {
    const { systemPrompt, userPrompt } = await findTargetCutoff({
      course: "Medicina",
      exam: "ENEM",
      institution: "UFMG",
      position: null,
      today: "2026-10-09",
    });

    expect(systemPrompt).toBe("Find the cut-off.\nCourse target.");
    expect(userPrompt).toContain('<untrusted_input name="COURSE">');
    expect(userPrompt).not.toContain("POSITION");
  });

  it("asks about a position with the position rules only", async () => {
    const { systemPrompt, userPrompt } = await findTargetCutoff({
      course: null,
      exam: "Concurso TCDF, Auditor",
      institution: null,
      position: "Auditor",
      today: "2026-10-09",
    });

    expect(systemPrompt).toBe("Find the cut-off.\nPosition target.");
    expect(userPrompt).toContain('<untrusted_input name="POSITION">');
    expect(userPrompt).not.toContain("COURSE");
    expect(userPrompt).not.toContain("INSTITUTION");
  });
});
