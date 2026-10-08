import "server-only";
import { randomUUID } from "node:crypto";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import {
  type Experimental_DecisionQuestion,
  type Experimental_DecisionResult,
  experimental_decide,
} from "ai";
import { getModelFamily } from "../_utils/model-family";
import { NO_PROMPT_TRAINING } from "../data-protection";
import { computeCallCostUsd } from "../pricing/call-cost";
import { type AiGenerationContext } from "../provenance/ai-generation-event";
import { captureAiGeneration } from "../provenance/ai-generation-sink";
import { readGatewayMetadata } from "../provenance/gateway-metadata";
import { toEvaluationRunRecord } from "./evaluation-event";
import { fitsTokenLimit } from "./evaluation-limits";
import { JEV_MODEL_ID, getEvaluationModel, getEvaluationTokenLimit } from "./evaluation-models";
import { type EvaluationRunAnswer, captureEvaluationRun } from "./evaluation-run-sink";
import { formatUntrustedInput } from "./untrusted-input";

type EvaluationQuestions = Record<string, Experimental_DecisionQuestion>;

const TIMEOUT_MS = 10_000;

/**
 * What to log and review for every verdict besides the answers. Field names
 * follow task provenance, so evaluation runs read like generation runs.
 */
export type EvaluationRunDetails = {
  /** The model that answered, which is the fallback when the requested one failed. */
  model: string;
  requestedModel: string;
  latencyMs: number;
  /** The delimited state the model evaluated. */
  state: string;
  usage: { inputTokens: number; outputTokens: number };
};

type EvaluationRun<QUESTIONS extends EvaluationQuestions> = EvaluationRunDetails & {
  answers: Experimental_DecisionResult<QUESTIONS>["answers"];
};

/**
 * Sends inputs over a model's documented limit straight to the fallback,
 * since the primary would reject them anyway and the learner would wait twice.
 */
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

/** Runs one model with its own deadline so a slow primary still leaves time to fall back. */
async function runModel<QUESTIONS extends EvaluationQuestions>({
  model,
  questions,
  state,
}: {
  model: string;
  questions: QUESTIONS;
  state: string;
}) {
  const result = await experimental_decide({
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    model: getEvaluationModel(model),
    providerOptions: { gateway: NO_PROMPT_TRAINING },
    questions,
    state,
  });

  return {
    answers: result.answers,
    model,
    providerMetadata: result.providerMetadata,
    usage: result.usage,
  };
}

/**
 * Logs one run for review and threshold tuning: the call (the model that answered, a fallback
 * showing here, its latency, tokens and cost) goes to every AI call sink with its answers, and
 * the evaluation log keeps the answers with their probabilities under the same run id, and the
 * input when `keepInput` says it may.
 */
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

/**
 * Asks typed questions (choice, score, boolean) about one shared state. The
 * inputs are delimited as untrusted data, oversized inputs skip to the
 * fallback, and an error or timeout reruns the same questions on the fallback.
 * The returned run carries everything needed to log and review the verdict.
 */
export async function evaluateQuestions<const QUESTIONS extends EvaluationQuestions>({
  analytics,
  fallbackModel,
  input,
  keepInput = false,
  model = JEV_MODEL_ID,
  questions,
  task,
}: {
  /** Who the run was for, like every task's `$ai_generation` event. */
  analytics?: AiGenerationContext;
  /** The runner-up from the task's eval, used when the model errors, times out or can't fit the input. */
  fallbackModel?: string;
  /** Untrusted fields by name, such as `{ USER_INPUT: prompt }`. */
  input: Readonly<Record<string, string>>;
  /**
   * Keep the input in the evaluation log. Only for tasks whose input is stored elsewhere anyway
   * (a goal's prompt, a tutor question, Library titles); text nobody keeps, such as a memory
   * candidate that may be sensitive, is logged by its hash alone.
   */
  keepInput?: boolean;
  model?: string;
  questions: QUESTIONS;
  /** Stable task name, matching the task's eval id, for the logged run. */
  task: string;
}): Promise<EvaluationRun<QUESTIONS>> {
  const startedAt = performance.now();
  const state = formatUntrustedInput(input);
  const primaryModel = selectModel({ fallbackModel, model, questions, state });

  const primary = await safeAsync(() => runModel({ model: primaryModel, questions, state }));

  if (primary.error && (!fallbackModel || fallbackModel === primaryModel)) {
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
