import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type StatuteDrillParams, generateStatuteDrills } from "./statute-drills";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./statute-drills.prompt.md", () => ({
  default: [
    "Drill the law.",
    "{{#fillInTheBlank}}",
    "Blank one word.",
    "{{/fillInTheBlank}}",
    "{{#choicesOnly}}",
    "Only picks.",
    "{{/choicesOnly}}",
  ].join("\n"),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const article = {
  reference: "Art. 5º, XI",
  text: "a casa é asilo inviolável do indivíduo, ninguém nela podendo penetrar sem consentimento do morador.",
};

const drill = {
  context: null,
  difficulty: "easy",
  format: "trueFalse",
  isTrue: true,
  misconception: null,
  reason: "Repete o texto do inciso.",
  reference: "Art. 5º, XI",
  statement:
    "A casa é asilo inviolável do indivíduo, ninguém nela podendo penetrar sem consentimento do morador.",
};

const params = {
  articles: [article],
  count: 1,
  language: "pt",
  law: { shortName: "CF/88", title: "Constituição Federal", url: null },
} satisfies Omit<StatuteDrillParams, "style">;

/** Every property name in a JSON schema, at any depth. */
function propertyNames(schema: unknown): string[] {
  if (Array.isArray(schema)) {
    return schema.flatMap((item) => propertyNames(item));
  }

  if (typeof schema !== "object" || schema === null) {
    return [];
  }

  return Object.entries(schema).flatMap(([key, value]) =>
    key === "properties" && typeof value === "object" && value !== null
      ? [...Object.keys(value), ...propertyNames(value)]
      : propertyNames(value),
  );
}

async function sentSchema(): Promise<unknown> {
  const format = await vi.mocked(generateText).mock.calls.at(-1)?.[0].output?.responseFormat;
  return format?.type === "json" ? format.schema : undefined;
}

describe(generateStatuteDrills, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ drills: [drill] }));
  });

  it.each(["cebraspe", "fgv", "generic"] as const)(
    "asks %s drills about the law's words, with no chart or picture fields",
    async (style) => {
      await generateStatuteDrills({ ...params, style });

      const names = propertyNames(await sentSchema());

      expect(names).toContain("reference");
      expect(names).not.toContain("visual");
      expect(names).not.toContain("image");
    },
  );

  it("writes fill-in-the-blank drills only for an exam that asks short written answers", async () => {
    const picks = await generateStatuteDrills({ ...params, style: "generic" });
    const picksSchema = propertyNames(await sentSchema());

    const blanks = await generateStatuteDrills({
      ...params,
      fillInTheBlank: true,
      style: "generic",
    });

    const blanksSchema = propertyNames(await sentSchema());

    expect(picks.systemPrompt).toBe("Drill the law.\nOnly picks.\n");
    expect(picksSchema).not.toContain("acceptedAnswers");
    expect(blanks.systemPrompt).toBe("Drill the law.\nBlank one word.\n");
    expect(blanksSchema).toContain("acceptedAnswers");
  });

  it("returns drills with no chart or picture", async () => {
    const { data } = await generateStatuteDrills({ ...params, style: "cebraspe" });

    expect(data.drills).toStrictEqual([{ ...drill, image: null, visual: null }]);
  });
});
