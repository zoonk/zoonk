import "server-only";
import { randomUUID } from "node:crypto";
import { Experimental_DecisionLanguageModel } from "@ai-sdk/provider-utils/experimental-decision";
import { isBlockedTestCall } from "@zoonk/utils/blocked-test-call";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import {
  type Experimental_DecisionModel,
  type Experimental_DecisionQuestion,
  type Experimental_DecisionResult,
  experimental_decide,
} from "ai";
import { getModelFamily } from "../_utils/model-family";
import { NO_PROMPT_TRAINING } from "../data-protection";
import { zoonkGateway } from "../gateway";
import { computeCallCostUsd } from "../pricing/call-cost";
import { type AiGenerationContext } from "../provenance/ai-generation-event";
import { captureAiGeneration } from "../provenance/ai-generation-sink";
import { readGatewayMetadata } from "../provenance/gateway-metadata";
import { toEvaluationRunRecord } from "./evaluation-event";
import { fitsTokenLimit } from "./evaluation-limits";
import {
  JEV_MODEL_ID,
  getEvaluationTokenLimit,
  isNativeEvaluationModel,
} from "./evaluation-models";
import { type EvaluationRunAnswer, captureEvaluationRun } from "./evaluation-run-sink";
import { EvaluationTimeoutError } from "./evaluation-timeout";
import { formatUntrustedInput } from "./untrusted-input";

type EvaluationQuestions = Record<string, Experimental_DecisionQuestion>;

function getEvaluationModel(modelId: string): Experimental_DecisionModel {
  if (isNativeEvaluationModel(modelId)) {
    return zoonkGateway.decisionModel(modelId);
  }

  return new Experimental_DecisionLanguageModel({ model: zoonkGateway.languageModel(modelId) });
}

const TIMEOUT_MS = 10_000;

export type EvaluationRunDetails = {
  /** The fallback when the requested model failed. */
  model: string;
  requestedModel: string;
  latencyMs: number;
  state: string;
  usage: { inputTokens: number; outputTokens: number };
};

type EvaluationRun<QUESTIONS extends EvaluationQuestions> = EvaluationRunDetails & {
  answers: Experimental_DecisionResult<QUESTIONS>["answers"];
};

function selectModel({
  fallbackModel,
  model,
  questions,
  state,
}: {
  fallbackModel?: string;
  model: string;
  questions: EvaluationQuestions;
  state: string;
}): string {
  const limit = getEvaluationTokenLimit(model);

  if (limit === null || fitsTokenLimit({ limit, questions, state })) {
    return model;
  }

  if (!fallbackModel) {
    throw new Error(`Input is over ${model}'s token limit and no fallback model was given.`);
  }

  return fallbackModel;
}

/**
 * A deadline that runs out, even while the AI SDK waits to retry, is a timeout
 * (`EvaluationTimeoutError`), never the cancellation the SDK reports it as.
 */
async function runModel<QUESTIONS extends EvaluationQuestions>({
  model,
  questions,
  state,
}: {
  model: string;
  questions: QUESTIONS;
  state: string;
}) {
  const deadline = AbortSignal.timeout(TIMEOUT_MS);

  const result = await experimental_decide({
    abortSignal: deadline,
    model: getEvaluationModel(model),
    providerOptions: { gateway: NO_PROMPT_TRAINING },
    questions,
    state,
  }).catch((error: unknown) => {
    if (deadline.aborted) {
      throw new EvaluationTimeoutError(`${model} didn't answer within ${TIMEOUT_MS} ms.`, {
        cause: error,
      });
    }

    throw error;
  });

  return {
    answers: result.answers,
    model,
    providerMetadata: result.providerMetadata,
    usage: result.usage,
  };
}

async function logEvaluation({
  analytics,
  input,
  keepInput,
  providerMetadata,
  questions,
  run,
  task,
}: {
  analytics?: AiGenerationContext;
  input: Readonly<Record<string, string>>;
  keepInput: boolean;
  providerMetadata: Readonly<Record<string, unknown>> | undefined;
  questions: EvaluationQuestions;
  run: EvaluationRunDetails & { answers: Readonly<Record<string, EvaluationRunAnswer>> };
  task: string;
}): Promise<void> {
  const gateway = readGatewayMetadata(providerMetadata);

  const provenance = {
    costUsd: computeCallCostUsd({
      model: run.model,
      serviceTier: gateway.serviceTier,
      usage: run.usage,
    }),
    credential: gateway.credential,
    gatewayCostUsd: gateway.costUsd,
    generatedAt: new Date().toISOString(),
    latencyMs: run.latencyMs,
    model: run.model,
    promptVersion: getPromptVersion({ systemPrompt: JSON.stringify(questions) }),
    provider: gateway.servedProvider ?? getModelFamily(run.model),
    requestedModel: run.requestedModel,
    runId: randomUUID(),
    serviceTier: gateway.serviceTier,
    usage: run.usage,
  };

  await Promise.all([
    captureAiGeneration({
      context: analytics,
      properties: { evaluation_answers: JSON.stringify(run.answers) },
      provenance,
      task,
    }),
    captureEvaluationRun(
      toEvaluationRunRecord({
        analytics,
        answers: run.answers,
        input,
        keepInput,
        provenance,
        state: run.state,
        task,
      }),
    ),
  ]);
}

/** Oversized inputs skip to the fallback, and an error or timeout reruns the questions on it. */
export async function evaluateQuestions<const QUESTIONS extends EvaluationQuestions>({
  analytics,
  fallbackModel,
  input,
  keepInput = false,
  model = JEV_MODEL_ID,
  questions,
  task,
}: {
  analytics?: AiGenerationContext;
  fallbackModel?: string;
  /** Untrusted fields by name, such as `{ USER_INPUT: prompt }`. */
  input: Readonly<Record<string, string>>;
  /**
   * Only for tasks whose input is stored elsewhere anyway; text nobody keeps, such as a memory
   * candidate that may be sensitive, is logged by its hash alone.
   */
  keepInput?: boolean;
  model?: string;
  questions: QUESTIONS;
  /** Matches the task's eval id. */
  task: string;
}): Promise<EvaluationRun<QUESTIONS>> {
  const startedAt = performance.now();
  const state = formatUntrustedInput(input);
  const primaryModel = selectModel({ fallbackModel, model, questions, state });

  const primary = await safeAsync(() => runModel({ model: primaryModel, questions, state }));

  if (
    primary.error &&
    (!fallbackModel || fallbackModel === primaryModel || isBlockedTestCall(primary.error))
  ) {
    throw primary.error;
  }

  if (primary.error) {
    logError(
      `Evaluation with ${primaryModel} failed; retrying with ${fallbackModel}.`,
      primary.error,
    );
  }

  const result =
    primary.data ?? (await runModel({ model: fallbackModel ?? primaryModel, questions, state }));

  const run: EvaluationRun<QUESTIONS> = {
    answers: result.answers,
    latencyMs: Math.round(performance.now() - startedAt),
    model: result.model,
    requestedModel: model,
    state,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    },
  };

  await logEvaluation({
    analytics,
    input,
    keepInput,
    providerMetadata: result.providerMetadata,
    questions,
    run,
    task,
  });

  return run;
}
