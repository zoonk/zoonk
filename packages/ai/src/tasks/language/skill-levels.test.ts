import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { classifySkillLevels } from "./skill-levels";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./skill-levels.prompt.md", () => ({ default: "Place skills." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const SKILLS = [
  { band: ["A1", "A2"], description: "Say why you came", id: "immigration", name: "Immigration" },
  { band: ["B1", "B2"], description: "Follow a meeting", id: "meeting", name: "Meetings" },
  { band: ["A1", "A2"], description: "Ask about the rent", id: "rent", name: "Rent" },
  { band: ["C1", "C2"], description: "Negotiate a lease", id: "lease", name: "Lease" },
] as const;

describe(classifySkillLevels, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps each answer to its own skill's band and leaves a skill skipped or answered both ways untagged", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        skills: [
          { id: "2", level: "upper" },
          { id: "1", level: "lower" },
          { id: "4", level: "lower" },
          { id: "4", level: "upper" },
          { id: "9", level: "upper" },
        ],
      }),
    );

    const { data, userPrompt } = await classifySkillLevels({
      skills: SKILLS,
      targetLanguage: "en",
    });

    expect(data.levels).toStrictEqual([
      { id: "immigration", level: "A1" },
      { id: "meeting", level: "B2" },
    ]);

    expect(userPrompt).toContain("TARGET_LANGUAGE: US English");
    expect(userPrompt).toContain("2. B1 or B2 | Meetings: Follow a meeting");
  });
});
