import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { NO_INSTALL_TOOL_KEY, generateStepVariant } from "./step-variant";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./step-variant.prompt.md", () => ({ default: "Rewrite the screen." }));
vi.mock("./step-variant-tool.prompt.md", () => ({ default: "In the tool." }));
vi.mock("./step-variant-no-install.prompt.md", () => ({ default: "Nothing installed." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const screen = {
  content: { text: "Type `=AVERAGE(A1:A3)`.", title: "The mean" },
  kind: "explanation",
} as const;

const written = {
  exampleLineIdea: null,
  explore: null,
  image: null,
  kind: "explanation",
  text: "Type `=AVERAGE(A1:A3)`.",
  title: "The mean",
  visual: null,
};

const params = { language: "en", lessonTitle: "Averages", level: "beginner", screen } as const;

describe(generateStepVariant, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult(written));
  });

  it("writes a tool's version with the tool's rules and its name", async () => {
    const { systemPrompt, userPrompt } = await generateStepVariant({ ...params, key: "Excel" });

    expect(systemPrompt).toBe("Rewrite the screen.\nIn the tool.");
    expect(userPrompt).toContain('<untrusted_input name="KEY">\nExcel\n</untrusted_input>');
  });

  it("writes the version for a learner who installs nothing with its rules only", async () => {
    const { systemPrompt, userPrompt } = await generateStepVariant({
      ...params,
      key: NO_INSTALL_TOOL_KEY,
    });

    expect(systemPrompt).toBe("Rewrite the screen.\nNothing installed.");
    expect(userPrompt).not.toContain("KEY");
  });
});
