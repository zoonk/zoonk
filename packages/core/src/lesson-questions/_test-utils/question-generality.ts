import { classifyQuestionGenerality } from "@zoonk/ai/tasks/v2/explain/question-generality";
import { vi } from "vitest";

const JEV = "typesafe-ai/jev";

/** A confident answer either way, as the classifier's thresholds read it. */
const GENERAL_PROBABILITY = 0.9;
const PERSONAL_PROBABILITY = 0.1;

/**
 * Answers the generality check the way the classifier would, without calling a model. The test
 * file mocks `@zoonk/ai/tasks/v2/explain/question-generality` for this to take effect.
 */
export function mockQuestionGenerality(isGeneral: boolean) {
  vi.mocked(classifyQuestionGenerality).mockResolvedValue({
    isGeneral,
    latencyMs: 1,
    model: JEV,
    probability: isGeneral ? GENERAL_PROBABILITY : PERSONAL_PROBABILITY,
    requestedModel: JEV,
    state: "",
    usage: { inputTokens: 0, outputTokens: 0 },
  });
}
