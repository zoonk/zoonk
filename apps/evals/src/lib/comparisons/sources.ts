import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import z from "zod";
import { getRunCost } from "../cost";
import { evalImageDigest, readEvalImage } from "../image-files";
import { getModelById } from "../models";
import { loadModelOutputs } from "../output-loader";
import { type OutputEntry } from "../types";
import { hash, hashJson } from "./identity";
import { type Variant, identifier, type runSchema, side } from "./schemas";
import { loadComparison } from "./storage";

export function resolveModel(modelId: string) {
  const model = getModelById(modelId);

  if (!model || (model.kind !== "generation" && model.kind !== "image")) {
    throw new Error(`Unknown generation variant ${modelId}`);
  }

  return model;
}

export function variantFor({
  entry,
  generation,
  modelId,
}: {
  entry: OutputEntry;
  generation: NonNullable<OutputEntry["generation"]>;
  modelId: string;
}): Variant {
  return {
    model: modelId,
    pipeline: [generation.model],
    reasoning: generation.reasoning,
    settingsHash: hashJson(generation),
    systemPromptHash: entry.initialPromptHashes?.system ?? hash(entry.systemPrompt),
  };
}

type Artifact = { runId: string; inputHash: string } & (
  | { slot: NonNullable<z.infer<typeof runSchema>["challenger"]>; output: string | Buffer }
  | { costUsd: number; reason: string }
);

type Source = {
  model: ReturnType<typeof resolveModel>;
  variant: Variant | null;
  artifacts: Artifact[];
  forecastCosts: number[];
};

async function sealedSource(taskId: string, spec: string): Promise<Source> {
  const [, comparisonId, role] = spec.split(":");
  const subject = side.parse(role);
  const comparison = await loadComparison(taskId, identifier.parse(comparisonId));
  const variant = comparison.manifest.variants[subject];

  if (!variant) {
    throw new Error("No such variant in the sealed comparison.");
  }

  if (!comparison.manifest.provenanceVersion) {
    throw new Error(
      "This sealed comparison predates generation provenance and can only be replayed.",
    );
  }

  const cases = new Map(comparison.manifest.cases.map((tc) => [tc.id, hashJson(tc.input)]));

  const artifacts = comparison.manifest.runsCompared.flatMap((run): Artifact[] => {
    const inputHash = cases.get(run.caseId);

    if (!inputHash) {
      throw new Error("Missing sealed case.");
    }

    const identity = { inputHash, runId: `${run.caseId}-${run.run}` };
    const slot = run[subject];
    const output = slot && comparison.outputs[slot.hash];

    const failures = run.failures
      .filter((failure) => failure.side === subject)
      .map(({ costUsd, reason }) => ({ ...identity, costUsd, reason }));

    return slot && output !== null && output !== undefined
      ? [{ ...identity, output, slot }, ...failures]
      : failures;
  });

  return {
    artifacts,
    forecastCosts: artifacts.flatMap((entry) => ("slot" in entry ? [entry.slot.costUsd] : [])),
    model: resolveModel(variant.model),
    variant,
  };
}

const imagePathSchema = z.object({ imagePath: z.string() });
const imagePathFor = (output: string) => imagePathSchema.parse(JSON.parse(output)).imagePath;

export function promptHashFor(entry: OutputEntry) {
  return entry.initialPromptHashes?.user ?? hash(entry.userPrompt);
}

export async function readRunOutput(output: string, image: boolean) {
  return image ? Buffer.from(await readEvalImage(imagePathFor(output))) : output;
}

async function savedImage(output: string): Promise<{ output: Buffer } | { reason: string }> {
  const imagePath = imagePathFor(output);
  const digest = evalImageDigest(imagePath);

  if (!digest) {
    return { reason: "Saved image has no digest from its generation." };
  }

  try {
    const bytes = Buffer.from(await readEvalImage(imagePath));

    return hash(bytes) === digest
      ? { output: bytes }
      : { reason: "Saved image no longer matches its generation digest." };
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }

    return { reason: "Saved image file is missing." };
  }
}

async function savedArtifact({
  costUsd,
  entry,
  image,
  inputHash,
  variant,
}: {
  costUsd: number;
  entry: OutputEntry;
  image: boolean;
  inputHash: string;
  variant: Variant;
}): Promise<Artifact> {
  const identity = { inputHash, runId: entry.testCaseId };
  const captured = image ? await savedImage(entry.output) : { output: entry.output };

  if ("reason" in captured) {
    return { ...identity, costUsd, reason: captured.reason };
  }

  return {
    ...identity,
    output: captured.output,
    slot: {
      costUsd,
      durationMs: entry.duration,
      hash: hash(captured.output),
      ...(image ? { mediaType: "image/webp" as const } : {}),
      systemPromptHash: variant.systemPromptHash,
      userPromptHash: promptHashFor(entry),
    },
  };
}

export async function source(taskId: string, spec: string): Promise<Source> {
  if (spec.startsWith("sealed:")) {
    return sealedSource(taskId, spec);
  }

  const [id, suffix] = spec.split("@");
  const model = resolveModel(id ?? "");
  const data = await loadModelOutputs(taskId, model.id);

  if (data && (data.taskId !== taskId || data.modelId !== model.id)) {
    throw new Error("Saved output file does not belong to the requested task and model.");
  }

  const saved = data?.outputs ?? [];
  const current = suffix === "current" || (!suffix && saved.length === 0);

  if (current) {
    return {
      artifacts: [],
      forecastCosts: saved.map((run) =>
        getRunCost({
          model: { gatewayModelId: run.generation?.model ?? model.gatewayModelId },
          prices: GATEWAY_PRICES,
          run,
        }),
      ),
      model,
      variant: null,
    };
  }

  const outputs = saved.flatMap((entry) => {
    if (!entry.generation?.sourceHash || !entry.caseInputHash) {
      return [];
    }

    const variant = variantFor({ entry, generation: entry.generation, modelId: model.id });

    return [
      {
        entry,
        gatewayModelId: entry.generation.model,
        inputHash: entry.caseInputHash,
        key: hashJson(variant),
        variant,
      },
    ];
  });

  if (outputs.length === 0) {
    throw new Error(
      `No saved outputs have generation provenance. Select ${model.id}@current to generate.`,
    );
  }

  const variants = new Map(outputs.map(({ key, variant }) => [key, variant]));

  const prefixes = suffix?.split("+") ?? [""];

  const matches = [...variants].filter(([key]) =>
    prefixes.some((prefix) => key.startsWith(prefix)),
  );

  if (
    prefixes.some((prefix) => matches.filter(([key]) => key.startsWith(prefix)).length !== 1) ||
    new Set(matches.map(([, found]) => hashJson({ ...found, systemPromptHash: "" }))).size !== 1
  ) {
    throw new Error(
      `Choose a model@variant-hash, or several joined by + that differ only in their rendered system prompt, from ${JSON.stringify(
        [...variants].map(([key, found]) => ({ key, systemPromptHash: found.systemPromptHash })),
      )}`,
    );
  }

  const selected = new Set(matches.map(([key]) => key));
  const first = matches[0]?.[1];

  if (!first) {
    throw new Error("No matching saved variant.");
  }

  const variant = {
    ...first,
    systemPromptHash:
      matches.length === 1
        ? first.systemPromptHash
        : hashJson(matches.map(([, found]) => found.systemPromptHash).toSorted()),
  };

  const candidates = outputs
    .filter(({ key }) => selected.has(key))
    .map((candidate) => ({
      ...candidate,
      costUsd: getRunCost({
        model: { gatewayModelId: candidate.gatewayModelId },
        prices: GATEWAY_PRICES,
        run: candidate.entry,
      }),
    }));

  const image = model.kind === "image";

  const artifacts = await Promise.all(
    candidates.map(({ costUsd, entry, inputHash, variant: produced }) =>
      savedArtifact({ costUsd, entry, image, inputHash, variant: produced }),
    ),
  );

  return { artifacts, forecastCosts: candidates.map(({ costUsd }) => costUsd), model, variant };
}
