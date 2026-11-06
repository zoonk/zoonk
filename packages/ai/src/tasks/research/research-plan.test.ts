import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readGatewayOptions } from "../_test-utils/gateway-options";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateExamResearchPlan } from "./research-plan";
import { generateSourceResearchPlan } from "./source-research-plan";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./research-plan.prompt.md", () => ({ default: "Plan the research." }));
vi.mock("./source-research-plan.prompt.md", () => ({ default: "Plan the research." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const PLAN = {
  board: null,
  classTest: false,
  country: "BR",
  edition: null,
  language: "pt",
  name: "ENEM",
  officialDomains: [],
  queries: [],
  role: null,
  searchTerms: [],
};

describe("research plans", () => {
  let gatewayOptions: unknown;

  beforeEach(() => {
    gatewayOptions = undefined;

    vi.mocked(generateText).mockImplementation(async () => {
      gatewayOptions = await readGatewayOptions();
      return createGenerateTextResult(PLAN);
    });
  });

  it("keep a learner's goal away from providers that train on prompts, even for shared research", async () => {
    const analytics = { contentScope: "shared" as const };
    const goal = "Passar no ENEM com 750, como a Maria";

    await generateExamResearchPlan({ analytics, goal });
    const examOptions = gatewayOptions;

    await generateSourceResearchPlan({ analytics, goal, topic: "syllabus" });

    expect([examOptions, gatewayOptions]).toStrictEqual([
      { disallowPromptTraining: true },
      { disallowPromptTraining: true },
    ]);
  });

  it("return product hints for a product goal only", async () => {
    const hints = { brand: "Lumen Works", name: "Orbit Notes", release: "Orbit Notes 5" };

    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ ...PLAN, product: hints }),
    );

    const product = await generateSourceResearchPlan({
      goal: "my Orbit Notes 5",
      topic: "product",
    });

    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult(PLAN));
    const syllabus = await generateSourceResearchPlan({ goal: "calculus", topic: "syllabus" });

    expect([product.data.product, syllabus.data.product]).toStrictEqual([hints, null]);
  });
});
