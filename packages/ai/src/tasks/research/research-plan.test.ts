import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noPromptTrainingMiddleware } from "../../data-protection";
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

type TextTransform = NonNullable<typeof noPromptTrainingMiddleware.transformParams>;
type TextParams = Parameters<TextTransform>[0]["params"];

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

/** What the gateway receives during the call: the filter is set while the task's model runs. */
async function readGatewayOptions(): Promise<unknown> {
  const params = await noPromptTrainingMiddleware.transformParams?.({
    model: { modelId: "google/gemini-3.8-flash" } as Parameters<TextTransform>[0]["model"],
    params: { prompt: [] } as TextParams,
    type: "generate",
  });

  return params?.providerOptions?.gateway;
}

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
});
