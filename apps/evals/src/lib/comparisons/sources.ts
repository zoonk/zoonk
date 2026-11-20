import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import z from "zod";
import { getFailedRunsCost, getRunCost } from "../cost";
import { readEvalImage } from "../image-files";
import { DEFAULT_REASONING, getModelById } from "../models";
import { loadModelOutputs } from "../output-loader";
import { type OutputEntry } from "../types";
import { hash, hashJson } from "./identity";
import { type Variant, identifier, type runSchema, side } from "./schemas";
import { loadComparison, readOptional } from "./storage";

export function resolveModel(modelId: string) {
  const model = getModelById(modelId);

  if (!model || (model.kind !== "generation" && model.kind !== "image")) {
    throw new Error(`Unknown generation variant ${modelId}`);
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
  output: string | Buffer;
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

const imagePathSchema = z.object({ imagePath: z.string() });

export async function readRunOutput(output: string, image: boolean) {
  return image
    ? Buffer.from(await readEvalImage(imagePathSchema.parse(JSON.parse(output)).imagePath))
    : output;
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

  const prefixes = suffix?.split("+") ?? [""];

  const matches = [...variants].filter(([key]) =>
    prefixes.some((prefix) => key.startsWith(prefix)),
  );

  const current = suffix === "current" || (!suffix && outputs.length === 0);

  if (
    !current &&
    (prefixes.some((prefix) => matches.filter(([key]) => key.startsWith(prefix)).length !== 1) ||
      new Set(matches.map(([, found]) => hashJson({ ...found, systemPromptHash: "" }))).size !== 1)
  ) {
    throw new Error(
      `Choose a model@variant-hash, or several joined by + that differ only in their rendered system prompt, from ${JSON.stringify(
        [...variants].map(([key, found]) => ({ key, systemPromptHash: found.systemPromptHash })),
      )}`,
    );
  }

  const selected = new Set(matches.map(([key]) => key));
  const first = matches[0]?.[1];

  const variant =
    current || !first
      ? null
      : {
          ...first,
          systemPromptHash:
            matches.length === 1
              ? first.systemPromptHash
              : hashJson(matches.map(([, found]) => found.systemPromptHash).toSorted()),
        };

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

  const image = model.kind === "image";


  const imagePaths = image
    ? outputs.map((entry) => imagePathSchema.parse(JSON.parse(entry.output)).imagePath)
    : [];

  const ambiguous = new Set(imagePaths.filter((file, index) => imagePaths.indexOf(file) !== index));

  const delivered = await Promise.all(
    outputs.map(async (entry, index): Promise<Delivery | Failure | null> => {
      if (current || !selected.has(hashJson(variantFor(model.id, entry)))) {
        return null;
      }

      const imagePath = imagePaths[index];

      if (imagePath && ambiguous.has(imagePath)) {
        return {
          costUsd: costs[index] ?? 0,
          reason: "Several saved runs share the same image file.",
          runId: entry.testCaseId,
        };
      }

      try {
        const output = await readRunOutput(entry.output, image);

        return {
          input: inputs.get(entry.testCaseId),
          inputHash: entry.caseInputHash,
          output,
          runId: entry.testCaseId,
          slot: {
            costUsd: costs[index] ?? 0,
            durationMs: entry.duration,
            hash: hash(output),
            ...(image ? { mediaType: "image/webp" as const } : {}),
            userPromptHash: hash(entry.userPrompt),
          },
        };
      } catch (error) {
        if (!image || !(error instanceof Error && "code" in error && error.code === "ENOENT")) {
          throw error;
        }

        return {
          costUsd: costs[index] ?? 0,
          reason: "Saved image file is missing.",
          runId: entry.testCaseId,
        };
      }
    }),
  );

  const deliveries = delivered.filter((entry) => entry !== null);

  const failures = (data?.failedRuns ?? []).map((fail) => ({
    costUsd: getFailedRunsCost({ failedRuns: [fail], prices: GATEWAY_PRICES }),
    reason: variants.size === 1 ? (fail.reason ?? "unknown") : "unattributed variant",
    runId: fail.testCaseId,
  }));

  return {
    costs,
    deliveries: deliveries.filter((entry) => "slot" in entry),
    failures: [...failures, ...deliveries.filter((entry) => "reason" in entry)],
    model,
    variant,
  };
}
