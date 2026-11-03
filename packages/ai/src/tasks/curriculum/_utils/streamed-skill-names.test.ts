import { describe, expect, it } from "vitest";
import { finishStreamedPart } from "./streamed-skill-names";

const step = {
  model: { modelId: "openai/gpt-6.1-terra", provider: "gateway" },
  providerMetadata: {},
  response: { modelId: "openai/gpt-6.1-terra" },
  usage: {
    inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 10 },
    inputTokens: 10,
    outputTokenDetails: { reasoningTokens: 0, textTokens: 5 },
    outputTokens: 5,
    totalTokens: 15,
  },
};

async function namesOf({
  failing = false,
  output,
  partials,
}: {
  failing?: boolean;
  output: unknown;
  partials: unknown[];
}) {
  const named: string[] = [];
  const namedAfterEachPartial: string[][] = [];

  async function* partialOutputStream() {
    for (const partial of partials) {
      yield partial;
      namedAfterEachPartial.push([...named]);
    }
  }

  const finished = await finishStreamedPart({
    generation: {
      finalStep: Promise.resolve(step),
      output: Promise.resolve(output),
      partialOutputStream: partialOutputStream(),
      steps: Promise.resolve([step]),
      usage: Promise.resolve(step.usage),
    },
    onSkillNamed: async (name) => {
      named.push(name);

      if (failing) {
        throw new Error("The event stream is down");
      }
    },
  });

  return { finished, named, namedAfterEachPartial };
}

describe(finishStreamedPart, () => {
  it("names each skill once the model starts the next one, and the last once the output is whole", async () => {
    const output = { skills: [{ name: "Variables" }, { name: "Loops" }] };

    const { finished, named, namedAfterEachPartial } = await namesOf({
      output,
      partials: [
        { skills: [{ name: "Vari" }] },
        { skills: [{ name: "Variables" }, { name: "Lo" }] },
        { skills: [{ name: "Variables" }, { name: "Loops" }] },
      ],
    });

    expect(namedAfterEachPartial).toStrictEqual([[], ["Variables"], ["Variables"]]);
    expect(named).toStrictEqual(["Variables", "Loops"]);
    expect(finished).toStrictEqual({ finalStep: step, output, steps: [step], usage: step.usage });
  });

  it("finishes the call and keeps naming skills when reporting a name fails", async () => {
    const output = { skills: [{ name: "Variables" }, { name: "Loops" }] };

    const { finished, named } = await namesOf({
      failing: true,
      output,
      partials: [{ skills: [{ name: "Variables" }, { name: "Lo" }] }],
    });

    expect(named).toStrictEqual(["Variables", "Loops"]);
    expect(finished.output).toBe(output);
  });

  it("cleans names as the saved graph does and skips skills without one", async () => {
    const output = {
      skills: [
        { name: "**Interpretar** textos" },
        { key: "no-name" },
        { name: "Ler — e entender" },
      ],
    };

    const { named } = await namesOf({ output, partials: [] });

    expect(named).toStrictEqual(["Interpretar textos", "Ler, e entender"]);
  });

  it("names nothing for output without skills, such as an exam's frame", async () => {
    const { named } = await namesOf({ output: { sections: [] }, partials: [{ sections: [] }] });

    expect(named).toStrictEqual([]);
  });
});
