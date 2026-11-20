import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import z from "zod";
import { getFailedRunsCost, getRunCost } from "../cost";
import { DEFAULT_REASONING, getModelById } from "../models";
import { loadModelOutputs } from "../output-loader";
import { type OutputEntry } from "../types";
import { hash, hashJson } from "./identity";
import { type Variant, identifier, type runSchema, side } from "./schemas";
import { loadComparison, readOptional } from "./storage";

export function resolveModel(modelId: string) {
  const model = getModelById(modelId);

  if (!model || model.kind !== "generation") {
    throw new Error(`Unknown text generation variant ${modelId}`);
  }

  return model;
}

export function variantFor(modelId: string, entry: OutputEntry): Variant {
  const model = resolveModel(modelId);
  const reasoning = model.reasoning ?? DEFAULT_REASONING;

  const pipeline = entry.calls?.length
    ? entry.calls.map((call) => call.modelId)
    : [model.gatewayModelId];

  return {
    model: modelId,
    pipeline,
    reasoning,
    settingsHash: hash(
      JSON.stringify({
        pipeline,
        reasoning,
        service:
          entry.calls
            ?.map((candidate) => [candidate.serviceTier ?? null, candidate.speed ?? null])
            .filter(
              (value, index, accumulator) =>
                index === 0 || !isDeepStrictEqual(value, accumulator[index - 1]),
            ) ?? [],
      }),
    ),
    systemPromptHash: hash(entry.systemPrompt),
  };
}

const storedCase = z.object({ id: z.string(), userInput: z.record(z.string(), z.unknown()) });
const resultsSchema = z.object({ results: z.array(z.object({ testCase: storedCase })) });

type Delivery = {
  runId: string;
  inputHash?: string;
  input: unknown;
  slot: NonNullable<z.infer<typeof runSchema>["challenger"]>;
  output: string;
};

type Failure = { runId: string; costUsd: number; reason: string };

type Source = {
  model: ReturnType<typeof resolveModel>;
  variant: Variant | null;
  deliveries: Delivery[];
  failures: Failure[];
  costs: number[];
};

async function sealedSource(taskId: string, spec: string): Promise<Source> {
  const [, comparisonId, role] = spec.split(":");
  const subject = side.parse(role);
  const comparison = await loadComparison(taskId, identifier.parse(comparisonId));
  const variant = comparison.manifest.variants[subject];

  if (!variant) {
    throw new Error("No such variant in the sealed comparison.");
  }

  const deliveries = comparison.manifest.runsCompared.flatMap((run) => {
    const slot = run[subject];
    const output = slot && comparison.outputs[slot.hash];

    if (!slot || !output) {
      return [];
    }

    const input = comparison.manifest.cases.find((tc) => tc.id === run.caseId)?.input;
    return [{ input, output, runId: `${run.caseId}-${run.run}`, slot }];
  });

  const failures = comparison.manifest.runsCompared.flatMap((run) =>
    run.failures
      .filter((failure) => failure.side === subject)
      .map((failure) => ({ ...failure, runId: `${run.caseId}-${run.run}` })),
  );

  return {
    costs: deliveries.map((entry) => entry.slot.costUsd),
    deliveries,
    failures,
    model: resolveModel(variant.model),
    variant,
  };
}
export async function source(taskId: string, spec: string): Promise<Source> {
  if (spec.startsWith("sealed:")) {
    return sealedSource(taskId, spec);
  }

  const [id, suffix] = spec.split("@");
  const model = resolveModel(id ?? "");
  const data = await loadModelOutputs(taskId, model.id);
  const outputs = data?.outputs ?? [];

  const variants = new Map(
    outputs.map((entry) => {
      const variant = variantFor(model.id, entry);
      return [hashJson(variant), variant];
    }),
  );

  const matches = [...variants].filter(([key]) => !suffix || key.startsWith(suffix));
  const current = suffix === "current" || (!suffix && outputs.length === 0);

  if (!current && matches.length !== 1) {
    throw new Error(`Choose a model@variant-hash from ${JSON.stringify([...variants.keys()])}`);
  }

  const variant = current ? null : (matches[0]?.[1] ?? null);

  const scores = await readOptional(
    path.join(
      "eval-results",
      "results",
      identifier.parse(taskId),
      `${model.id.replaceAll("/", "-")}.json`,
    ),
    resultsSchema,
  );

  const inputs = new Map(
    scores?.results.map((record) => [record.testCase.id, record.testCase.userInput]),
  );

  const costs = outputs.map((run) => getRunCost({ model, prices: GATEWAY_PRICES, run }));

  const deliveries = outputs.flatMap((entry, index) => {
    if (!isDeepStrictEqual(variantFor(model.id, entry), variant)) {
      return [];
    }

    return [
      {
        input: inputs.get(entry.testCaseId),
        inputHash: entry.caseInputHash,
        output: entry.output,
        runId: entry.testCaseId,
        slot: {
          costUsd: costs[index] ?? 0,
          durationMs: entry.duration,
          hash: hash(entry.output),
          userPromptHash: hash(entry.userPrompt),
        },
      },
    ];
  });

  const failures = (data?.failedRuns ?? []).map((fail) => ({
    costUsd: getFailedRunsCost({ failedRuns: [fail], prices: GATEWAY_PRICES }),
    reason: variants.size === 1 ? (fail.reason ?? "unknown") : "unattributed variant",
    runId: fail.testCaseId,
  }));

  return { costs, deliveries, failures, model, variant };
}
