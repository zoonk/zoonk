import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type EssayRubric, gradeEssay } from "./grade-essay";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./grade-essay.prompt.md", () => ({
  default: [
    "Grade the essay.",
    "{{#enem}}",
    "ENEM rubric.",
    "{{/enem}}",
    "{{#oab}}",
    "OAB rubric.",
    "{{/oab}}",
    "{{#ap}}",
    "AP rubric.",
    "{{/ap}}",
    "{{#custom}}",
    "Custom rubric.",
    "{{/custom}}",
    "Answer.",
    "{{#enem}}",
    "ENEM fields.",
    "{{/enem}}",
    "",
  ].join("\n"),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const ESSAY = Array.from({ length: 40 }, () => "Uma frase completa sobre o tema proposto.").join(
  " ",
);

const criterion = { comment: "Ok.", example: null, nextStep: "Revise.", quote: null, score: 0 };

function criteriaOutput(ids: string[]) {
  return Object.fromEntries(ids.map((id) => [id, criterion]));
}

async function requestedSchemaFields(): Promise<string[]> {
  const output = vi.mocked(generateText).mock.calls[0]?.[0].output;
  const format = await output?.responseFormat;
  const schema = format?.type === "json" ? format.schema : undefined;
  return Object.keys((schema as { properties?: object } | undefined)?.properties ?? {});
}

describe(gradeEssay, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends only the ENEM rubric, and asks for the proposal elements and annulment", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        criteria: criteriaOutput(["c1", "c2", "c3", "c4", "c5"]),
        interventionElements: null,
        zeroReason: null,
      }),
    );

    const { systemPrompt } = await gradeEssay({
      essay: ESSAY,
      language: "pt",
      prompt: "Tema",
      rubric: { kind: "enem" },
    });

    expect(systemPrompt).toBe("Grade the essay.\nENEM rubric.\nAnswer.\nENEM fields.\n");
    expect(vi.mocked(generateText).mock.calls[0]?.[0].instructions).toBe(systemPrompt);

    await expect(requestedSchemaFields()).resolves.toStrictEqual([
      "criteria",
      "interventionElements",
      "zeroReason",
    ]);
  });

  it.each<{ rubric: EssayRubric; prompt: string; ids: string[] }>([
    {
      ids: ["addressing-and-parties", "facts", "legal-basis", "requests", "closing-and-form"],
      prompt: "OAB rubric.",
      rubric: { kind: "oab" },
    },
    {
      ids: ["criterion-1"],
      prompt: "AP rubric.",
      rubric: {
        criteria: [{ criterion: "Claim", description: "A claim.", points: 1 }],
        kind: "ap",
      },
    },
    {
      ids: ["criterion-1"],
      prompt: "Custom rubric.",
      rubric: {
        criteria: [{ criterion: "Clarity", description: "Clear." }],
        kind: "custom",
        maxScore: 10,
      },
    },
  ])(
    "sends only the $rubric.kind rubric and no ENEM-only fields",
    async ({ ids, prompt, rubric }) => {
      vi.mocked(generateText).mockResolvedValueOnce(
        createGenerateTextResult({ criteria: criteriaOutput(ids) }),
      );

      const { data, systemPrompt } = await gradeEssay({
        essay: ESSAY,
        language: "en",
        prompt: "Question",
        rubric,
      });

      expect(systemPrompt).toBe(`Grade the essay.\n${prompt}\nAnswer.\n`);
      await expect(requestedSchemaFields()).resolves.toStrictEqual(["criteria"]);
      expect(data.enemInterventionElements).toBeNull();
      expect(data.zeroReason).toBeNull();
    },
  );

  it("returns the rubric's prompt for a text too short to grade, without a model", async () => {
    const { data, systemPrompt } = await gradeEssay({
      essay: "Curta.",
      language: "pt",
      prompt: "Tema",
      rubric: { kind: "enem" },
    });

    expect(generateText).not.toHaveBeenCalled();
    expect(data.zeroReason).toBe("tooShort");
    expect(systemPrompt).toBe("Grade the essay.\nENEM rubric.\nAnswer.\nENEM fields.\n");
  });
});
