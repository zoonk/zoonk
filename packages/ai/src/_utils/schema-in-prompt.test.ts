import { NoObjectGeneratedError } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { schemaInPrompt } from "./schema-in-prompt";

const note = z.object({ text: z.string() }).nullable();

const schema = z.object({
  screens: z.array(
    z.union([
      z.object({ kind: z.literal("text"), note, text: z.string() }),
      z.object({ kind: z.literal("count"), note, total: z.number() }),
    ]),
  ),
  title: z.string(),
});

const { output, outputRules } = schemaInPrompt(schema);

const context = {
  finishReason: "stop" as const,
  response: { id: "response", modelId: "model", timestamp: new Date(0) },
  usage: {
    inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 0 },
    inputTokens: 0,
    outputTokenDetails: { reasoningTokens: 0, textTokens: 0 },
    outputTokens: 0,
    totalTokens: 0,
  },
};

function parse(text: string) {
  return output.parseCompleteOutput({ text }, context as never);
}

describe(schemaInPrompt, () => {
  it("puts the schema in the prompt once, with each reused part written once", () => {
    expect(outputRules).toMatch(/^# Output format\n/u);
    expect(outputRules).toContain('"const":"count"');
    expect(outputRules.match(/"text":\{"type":"string"\}/gu)).toHaveLength(2);
    expect(outputRules).toContain('"$ref"');
  });

  it("reads JSON in Markdown fences and a key left out as null where null is a value it takes", async () => {
    const text = [
      "```json",
      JSON.stringify({
        screens: [
          { kind: "text", text: "Hi" },
          { kind: "count", note: { text: "Two" }, total: 2 },
        ],
        title: "A",
      }),
      "```",
    ].join("\n");

    await expect(parse(text)).resolves.toStrictEqual({
      screens: [
        { kind: "text", note: null, text: "Hi" },
        { kind: "count", note: { text: "Two" }, total: 2 },
      ],
      title: "A",
    });
  });

  it("reads a key left out inside a nullable union's branch as null", async () => {
    const visual = z
      .union([
        z.object({ kind: z.literal("chart"), source: z.string().nullable() }),
        z.object({ kind: z.literal("timeline"), title: z.string() }),
      ])
      .nullable();

    const visualOutput = schemaInPrompt(z.object({ visual })).output;

    await expect(
      visualOutput.parseCompleteOutput(
        { text: JSON.stringify({ visual: { kind: "chart" } }) },
        context as never,
      ),
    ).resolves.toStrictEqual({ visual: { kind: "chart", source: null } });
  });

  it("repairs the answer before checking it, and still fails what the repair leaves out of bounds", async () => {
    const titled = z.object({ title: z.string().max(5) });

    const { output: repaired } = schemaInPrompt(titled, {
      repair: (value) => ({ title: (value as { title: string }).title.slice(0, 5) }),
    });

    await expect(
      repaired.parseCompleteOutput(
        { text: JSON.stringify({ title: "Photosynthesis" }) },
        context as never,
      ),
    ).resolves.toStrictEqual({ title: "Photo" });

    const { output: unrepaired } = schemaInPrompt(titled);

    await expect(
      unrepaired.parseCompleteOutput(
        { text: JSON.stringify({ title: "Photosynthesis" }) },
        context as never,
      ),
    ).rejects.toBeInstanceOf(NoObjectGeneratedError);
  });

  it("fails on text that isn't JSON or a value the schema rejects, so the step retries", async () => {
    await expect(parse("Here is the lesson.")).rejects.toBeInstanceOf(NoObjectGeneratedError);

    await expect(
      parse(JSON.stringify({ screens: [{ kind: "count" }], title: "A" })),
    ).rejects.toBeInstanceOf(NoObjectGeneratedError);
  });
});
