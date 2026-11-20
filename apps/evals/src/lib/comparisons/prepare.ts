import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import z from "zod";
import { getTestCaseLanguage } from "../case-languages";
import { getCallCost, getRunCost } from "../cost";
import { generateComparisonRun } from "../output-generator";
import { type RegisteredTask } from "../types";
import { hash, hashJson, promptHash } from "./identity";
import { buildPackets } from "./packets";
import readerProtocol from "./protocols/reader.md";
import verifierProtocol from "./protocols/verifier.md";
import { pricesFor } from "./reader-prices";
import {
  type Reader,
  controlsSchema,
  identifier,
  manifestSchema,
  runSchema,
  selectionSchema,
  variantSchema,
} from "./schemas";
import { readRunOutput, resolveModel, source, variantFor } from "./sources";
import { directory, readBlob, readOptional, readOutputs, writeBytes, writeRecord } from "./storage";

const plannedSelection = selectionSchema.extend({
  challengerModel: z.string(),
  variants: z.object({ challenger: variantSchema.nullable(), incumbent: variantSchema.nullable() }),
});

const frozenSchema = plannedSelection.extend({ generate: z.boolean(), slots: z.array(runSchema) });
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
};
export async function prepare(options: PrepareOptions) {
  const dir = directory(options.task.id, options.id);
  const existing = await readOptional(path.join(dir, "manifest.json"), manifestSchema);

  if (existing) {
    return existing;
  }

  const file = path.join(dir, "selection.json");
  const frozen = (await readOptional(file, frozenSchema)) ?? (await freeze(options));

  if (options.stopAfterFreeze) {
    return null;
  }

  const runsCompared = await frozen.slots.reduce(
    async (previous, planned) => [
      ...(await previous),
      await sealRun({ dir, frozen, planned, task: options.task }),
    ],
    Promise.resolve<Run[]>([]),
  );

  const outputs = await readOutputs(dir, { controls: frozen.controls, runsCompared });

  const variant =
    frozen.variants.challenger ??
    (await readOptional(path.join(dir, "challenger.json"), variantSchema));

  if (!variant) {
    throw new Error("No successful generation identified the requested challenger.");
  }

  const variants = { ...frozen.variants, challenger: variant };
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
  readers,
}: {
  challenger: Awaited<ReturnType<typeof source>>;
  image: boolean;
  incumbent: Awaited<ReturnType<typeof source>> | null;
  readers: Reader[];
}) {
  if (
    [challenger, incumbent].some((variant) => variant && (variant.model.kind === "image") !== image)
  ) {
    throw new Error("Choose a model that generates the task’s output type.");
  }

  if (image && readers.some((reader) => reader.channel === "seat")) {
    throw new Error("Image packets require gateway model readers.");
  }
}

async function freeze(options: PrepareOptions) {
  const { task } = options;

  const cases = task.testCases
    .filter((item) => options.caseIds.length === 0 || options.caseIds.includes(item.id))
    .map((tc) => ({
      expectations: tc.expectations ?? "",
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

  assertOutputType({ challenger, image, incumbent, readers: options.readers });

  const readers = withReserve(options.readers, challenger.model.id, incumbent?.model.id);

  const selection = plannedSelection.parse({
    cases,
    challengerModel: challenger.model.id,
    controls,
    criteria: task.criteria ?? (image ? task.scoreCategories : []) ?? [],
    date: new Date().toISOString(),
    id: options.id,
    latencyBudget: task.latencyBudget ?? null,
    priorities: task.priorities,
    protocols: { reader: readerProtocol, verifier: verifierProtocol },
    question: options.question,
    readers,
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

        run.failures.push(
          ...src.failures
            .filter((fail) => fail.runId === runId)
            .map((fail) => ({ costUsd: fail.costUsd, reason: fail.reason, side })),
        );

        const captured = src.deliveries.find(
          (entry) =>
            entry.runId === runId &&
            (entry.inputHash
              ? entry.inputHash === hashJson(tc.input)
              : isDeepStrictEqual(entry.input, tc.input)),
        );

        if (captured) {
          run[side] = captured.slot;
          blobs.set(captured.slot.hash, captured.output);
        }
      });

      return run;
    }),
  );

  const generation = generationForecast({
    generate: options.generate,
    history: challenger.costs,
    slots,
  });

  const inputTokens =
    (image ? 6 * 2000 : Math.max(1000, ...[...blobs.values()].map((slot) => slot.length))) +
    JSON.stringify(selection.controls).length +
    JSON.stringify(selection.criteria).length;

  const prices = await pricesFor(
    readers.filter((reader) => reader.channel !== "owner").map((reader) => reader.model),
  );

  const byReader = readers.map((reader) => ({
    estimatedUsd:
      reader.channel === "owner"
        ? 0
        : slots.length *
          getCallCost({
            modelId: reader.model,
            prices,
            usage: { inputTokens, outputTokens: 3000 },
          }),
    packets: reader.channel === "owner" ? selection.cases.length : slots.length,
    reader,
  }));

  const usd =
    (generation ?? 0) +
    byReader.reduce((accumulator, record) => accumulator + record.estimatedUsd, 0);

  process.stdout.write(
    `${JSON.stringify({
      forecast: {
        byReader,
        conditional:
          "Includes reserve-reader allowance. Reverse reads, answer-key solves and verification are conditional.",
        generation,
        initialGatewayUsd: usd,
      },
    })}\n`,
  );

  if ((generation === null || usd > options.limit) && !options.confirm) {
    throw new Error("Forecast exceeds --limit-usd. Confirm with --confirm.");
  }

  const dir = directory(task.id, options.id);

  await Promise.all(
    [...blobs].map(([key, data]) => writeBytes(path.join(dir, "outputs", key), data)),
  );

  return writeRecord(path.join(dir, "selection.json"), frozenSchema, {
    ...selection,
    generate: options.generate,
    slots,
  });
}

type Frozen = z.infer<typeof frozenSchema>;
type Run = z.infer<typeof runSchema>;

async function sealRun({
  planned,
  dir,
  frozen,
  task,
}: {
  planned: Run;
  dir: string;
  frozen: Frozen;
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
    await generateSlot({ dir, frozen, run, task });
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
  dir,
  frozen,
  task,
  run,
}: {
  dir: string;
  frozen: Frozen;
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
      model: resolveModel(frozen.challengerModel),
      prices: GATEWAY_PRICES,
      run: entry,
    });

    const produced = variantFor(frozen.challengerModel, entry);

    const expected =
      frozen.variants.challenger ??
      (await readOptional(path.join(dir, "challenger.json"), variantSchema));

    if (!expected || isDeepStrictEqual(produced, expected)) {
      if (!expected) {
        await writeRecord(path.join(dir, "challenger.json"), variantSchema, produced);
      }

      const output = await readRunOutput(entry.output, task.output === "image");

      run.challenger = {
        costUsd,
        durationMs: entry.duration,
        hash: hash(output),
        ...(task.output === "image" ? { mediaType: "image/webp" as const } : {}),
        userPromptHash: promptHash(entry.userPrompt),
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

function withReserve(requested: Reader[], challenger: string, incumbent?: string) {
  const families = new Set([challenger, incumbent].map((model) => model?.split("/")[0]));

  const mandatoryNeon = families.has("openai") && families.has("anthropic");

  return requested.some((reader) => reader.family === "google")
    ? requested
    : [
        ...requested,
        {
          channel: "gateway",
          family: "google",
          model: "google/gemini-4-neon",
          reserve: !mandatoryNeon,
        } as const,
      ];
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
