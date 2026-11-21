import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import z from "zod";
import { getTestCaseLanguage } from "../case-languages";
import { getRunCost } from "../cost";
import { captureEvalImages } from "../image-files";
import { generateComparisonRun } from "../output-generator";
import { type RegisteredTask } from "../types";
import { confirmForecast, forecastReads } from "./forecast";
import { generationSourceHash } from "./generation-source";
import { hash, hashJson } from "./identity";
import { buildPackets } from "./packets";
import readerProtocol from "./protocols/reader.md";
import verifierProtocol from "./protocols/verifier.md";
import { assertReaderPlan, freezeReaders } from "./reader-selection";
import {
  type Reader,
  controlsSchema,
  digest,
  identifier,
  manifestSchema,
  runSchema,
  selectionSchema,
  variantSchema,
} from "./schemas";
import { promptHashFor, readRunOutput, resolveModel, source, variantFor } from "./sources";
import { directory, readBlob, readOptional, readOutputs, writeBytes, writeRecord } from "./storage";

const plannedSelection = selectionSchema.extend({
  challengerModel: z.string(),
  variants: z.object({ challenger: variantSchema.nullable(), incumbent: variantSchema.nullable() }),
});

const frozenSchema = plannedSelection.extend({
  generate: z.boolean(),
  generationSource: digest.optional(),
  provenanceVersion: z.literal(1).optional(),
  slots: z.array(runSchema),
});
export type PrepareOptions = {
  task: RegisteredTask;
  id: string;
  challenger: string;
  incumbent?: string;
  caseIds: string[];
  runs: number;
  bank: string;
  readers: Reader[];
  limit: number;
  confirm: boolean;
  generate: boolean;
  question: string;
  stopAfterFreeze: boolean;
  reserve?: string;
  reserveCap?: number;
  sealOnly?: boolean;
};
export async function prepare(options: PrepareOptions) {
  const dir = directory(options.task.id, options.id);
  const existing = await readOptional(path.join(dir, "manifest.json"), manifestSchema);

  if (existing) {
    return existing;
  }

  const file = path.join(dir, "selection.json");
  const frozen = (await readOptional(file, frozenSchema)) ?? (await freeze(options));

  if (!frozen.provenanceVersion) {
    throw new Error(
      "This pending selection predates generation provenance. Use a new comparison ID.",
    );
  }

  assertReaderPlan({
    challenger: frozen.challengerModel,
    incumbent: frozen.variants.incumbent?.model,
    readers: frozen.readers,
  });

  if (options.stopAfterFreeze) {
    return null;
  }

  if (options.sealOnly && frozen.generate && frozen.slots.some((run) => !run.challenger)) {
    throw new Error(
      "This selection requires generation. Use a new comparison ID to seal only saved outputs.",
    );
  }

  const currentGenerationSource = frozen.generationSource && generationSourceHash();

  const runsCompared = await frozen.slots.reduce(async (previous, planned) => {
    const sealed = await previous;

    const run = await sealRun({
      currentGenerationSource,
      dir,
      frozen,
      planned,
      previous: sealed,
      task: options.task,
    });

    return [...sealed, run];
  }, Promise.resolve<Run[]>([]));

  const outputs = await readOutputs(dir, { controls: frozen.controls, runsCompared });

  const variant =
    frozen.variants.challenger ??
    (await readOptional(path.join(dir, "challenger.json"), variantSchema));

  if (!variant) {
    throw new Error("No successful generation identified the requested challenger.");
  }

  const systemPrompts = [
    ...new Set(
      runsCompared.flatMap(({ challenger }) =>
        challenger?.systemPromptHash ? [challenger.systemPromptHash] : [],
      ),
    ),
  ].toSorted();

  const variants = {
    ...frozen.variants,
    challenger:
      frozen.generationSource && systemPrompts.length > 1
        ? { ...variant, systemPromptHash: hashJson(systemPrompts) }
        : variant,
  };

  const packets = buildPackets({ ...frozen, runsCompared, variants }, outputs);

  return writeRecord(path.join(dir, "manifest.json"), manifestSchema, {
    ...frozen,
    packets,
    runsCompared,
    variants,
  });
}

async function controlBlobs(controls: z.infer<typeof controlsSchema>, image: boolean) {
  const blobs = new Map<string, string | Buffer>();

  await Promise.all(
    controls.pairs.flatMap(({ clean, flawed }) =>
      [clean, flawed].map(async (item) => {
        if ((typeof item !== "string") !== image) {
          throw new TypeError("The control bank needs the same output type as the task.");
        }

        if (typeof item !== "string") {
          const data = await readBlob(path.join("eval-results", "controls"), item.image);
          blobs.set(item.image, data);
        }
      }),
    ),
  );

  return blobs;
}

function assertOutputType({
  challenger,
  image,
  incumbent,
}: {
  challenger: Awaited<ReturnType<typeof source>>;
  image: boolean;
  incumbent: Awaited<ReturnType<typeof source>> | null;
}) {
  if (
    [challenger, incumbent].some((variant) => variant && (variant.model.kind === "image") !== image)
  ) {
    throw new Error("Choose a model that generates the task’s output type.");
  }
}

async function freeze(options: PrepareOptions) {
  const { task } = options;

  const cases = task.testCases
    .filter((item) => options.caseIds.length === 0 || options.caseIds.includes(item.id))
    .map((tc) => ({
      expectations: tc.expectations ?? "",
      expected: tc.expected,
      id: tc.id,
      input: tc.userInput,
      language: getTestCaseLanguage(tc) ?? "unknown",
    }));

  if (options.caseIds.some((id) => !cases.some((candidate) => candidate.id === id))) {
    throw new Error("Unknown selected case.");
  }

  const [challenger, incumbent, controls] = await Promise.all([
    source(task.id, options.challenger),
    options.incumbent ? source(task.id, options.incumbent) : null,
    readOptional(
      path.join("eval-results", "controls", `${identifier.parse(options.bank)}.json`),
      controlsSchema,
    ),
  ]);

  if (incumbent && !incumbent.variant) {
    throw new Error("Select an existing incumbent or omit it for an audit.");
  }

  const image = task.output === "image";

  assertOutputType({ challenger, image, incumbent });

  const readers = freezeReaders({
    challenger: challenger.model.id,
    incumbent: incumbent?.model.id,
    requested: options.readers,
    reserve: options.reserve,
  });

  const selection = plannedSelection.parse({
    cases,
    challengerModel: challenger.model.id,
    codeCheck: image ? "background and frame" : task.codeChecks && "code checks",
    controls,
    criteria: task.criteria ?? (image ? task.scoreCategories : []) ?? [],
    date: new Date().toISOString(),
    id: options.id,
    latencyBudget: task.latencyBudget ?? null,
    priorities: task.priorities,
    protocols: { reader: readerProtocol, verifier: verifierProtocol },
    question: options.question,
    readers,
    requiresAnswerKeyCheck: task.requiresAnswerKeyCheck,
    reserveCap: options.reserveCap,
    runs: options.runs,
    taskId: task.id,
    variants: { challenger: challenger.variant, incumbent: incumbent?.variant ?? null },
    version: 1,
  });

  if (
    selection.criteria.length === 0 ||
    controls?.pairs.some(
      (pair) => !selection.criteria.some((candidate) => candidate.id === pair.criterion),
    )
  ) {
    throw new Error("The control bank needs to match the task criteria.");
  }

  const blobs = await controlBlobs(selection.controls, image);

  const slots = cases.flatMap((tc) =>
    Array.from({ length: options.runs }, (_, index) => {
      const runId = `${tc.id}-${index + 1}`;
      const inputHash = hashJson(tc.input);

      const run: z.infer<typeof runSchema> = {
        caseId: tc.id,
        challenger: null,
        failures: [],
        incumbent: null,
        run: index + 1,
      };

      (["incumbent", "challenger"] as const).forEach((side) => {
        const src = side === "incumbent" ? incumbent : challenger;

        if (!src) {
          return;
        }

        const artifacts = src.artifacts.filter(
          (artifact) => artifact.runId === runId && artifact.inputHash === inputHash,
        );

        for (const artifact of artifacts) {
          if ("slot" in artifact) {
            if (run[side]) {
              throw new Error(
                `Several saved outputs match ${side} run ${runId}. Choose one variant.`,
              );
            }

            run[side] = artifact.slot;
            blobs.set(artifact.slot.hash, artifact.output);
          } else {
            run.failures.push({ costUsd: artifact.costUsd, reason: artifact.reason, side });
          }
        }
      });

      return run;
    }),
  );

  const generate = options.generate && !challenger.variant;
  const generation = generationForecast({ generate, history: challenger.forecastCosts, slots });

  const byReader = options.sealOnly
    ? []
    : await forecastReads(selection, slots, blobs, Boolean(incumbent), generate);

  confirmForecast(byReader, generation, options.limit, options.confirm);

  const dir = directory(task.id, options.id);

  await Promise.all(
    [...blobs].map(([key, data]) => writeBytes(path.join(dir, "outputs", key), data)),
  );

  return writeRecord(path.join(dir, "selection.json"), frozenSchema, {
    ...selection,
    generate,
    generationSource: generate ? generationSourceHash() : undefined,
    provenanceVersion: 1,
    slots,
  });
}

type Frozen = z.infer<typeof frozenSchema>;
type Run = z.infer<typeof runSchema>;

async function sealRun({
  currentGenerationSource,
  planned,
  dir,
  frozen,
  previous,
  task,
}: {
  currentGenerationSource?: string;
  planned: Run;
  dir: string;
  frozen: Frozen;
  previous: Run[];
  task: RegisteredTask;
}) {
  const saved = path.join(
    dir,
    "runs",
    `${hash(JSON.stringify([planned.caseId, planned.run]))}.json`,
  );

  const existing = await readOptional(saved, runSchema);

  if (existing) {
    return existing;
  }

  const run = structuredClone(planned);

  if (!run.challenger && frozen.generate) {
    if (!currentGenerationSource || currentGenerationSource !== frozen.generationSource) {
      throw new Error(
        "Generation source changed since selection was frozen. Restore it or use a new comparison ID.",
      );
    }

    const casePrompt = previous.find((prior) => prior.caseId === run.caseId && prior.challenger)
      ?.challenger?.systemPromptHash;

    await captureEvalImages(() =>
      generateSlot({ casePrompt, dir, frozen, run, sourceHash: currentGenerationSource, task }),
    );
  }

  if (
    run.incumbent &&
    run.challenger &&
    run.incumbent.userPromptHash !== run.challenger.userPromptHash
  ) {
    run.incumbent = null;
  }

  return writeRecord(saved, runSchema, run);
}

async function generateSlot({
  casePrompt,
  dir,
  frozen,
  sourceHash,
  task,
  run,
}: {
  casePrompt?: string;
  dir: string;
  frozen: Frozen;
  sourceHash: string;
  task: RegisteredTask;
  run: Run;
}) {
  const tc = frozen.cases.find((item) => item.id === run.caseId);

  if (!tc) {
    throw new Error("Missing frozen case.");
  }

  const result = await generateComparisonRun({
    model: resolveModel(frozen.challengerModel),
    runNumber: run.run,
    sourceHash,
    task,
    testCase: {
      expectations: tc.expectations,
      id: tc.id,
      language: tc.language,
      userInput: tc.input,
    },
  });

  if (result.output) {
    const entry = result.output;

    const costUsd = getRunCost({
      model: { gatewayModelId: entry.generation.model },
      prices: GATEWAY_PRICES,
      run: entry,
    });

    const produced = variantFor({
      entry,
      generation: entry.generation,
      modelId: frozen.challengerModel,
    });

    const expected = await readOptional(path.join(dir, "challenger.json"), variantSchema);

    if (
      !expected ||
      isDeepStrictEqual(produced, {
        ...expected,
        systemPromptHash: casePrompt ?? produced.systemPromptHash,
      })
    ) {
      if (!expected) {
        await writeRecord(path.join(dir, "challenger.json"), variantSchema, produced);
      }

      const output = await readRunOutput(entry.output, task.output === "image");

      run.challenger = {
        costUsd,
        durationMs: entry.duration,
        hash: hash(output),
        ...(task.output === "image" ? { mediaType: "image/webp" as const } : {}),
        systemPromptHash: produced.systemPromptHash,
        userPromptHash: promptHashFor(entry),
      };

      await writeBytes(path.join(dir, "outputs", run.challenger.hash), output);
    } else {
      run.failures.push({
        costUsd,
        reason: "Generated variant differs from frozen variant",
        side: "challenger",
      });
    }
  } else {
    run.failures.push({ costUsd: result.costUsd, reason: result.reason, side: "challenger" });
  }
}

function generationForecast({
  generate,
  slots,
  history,
}: {
  generate: boolean;
  slots: Run[];
  history: number[];
}) {
  const missing = slots.filter((slot) => !slot.challenger).length;

  const mean =
    history.length === 0 ? null : history.reduce((sum, cost) => sum + cost, 0) / history.length;

  const estimated = mean === null ? null : missing * mean;
  return generate && missing > 0 ? estimated : 0;
}
