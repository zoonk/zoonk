import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { getCallsCost } from "@/lib/cost";
import { toModelCall } from "@/lib/types";
import {
  CALIBRATION_REPEATS,
  getCalibrationJobs,
  getKeysRevision,
  listCalibrationCohorts,
  readCalibrationKeys,
} from "@/tasks/grade-essay/calibration-cases";
import { gradeEssayTask } from "@/tasks/grade-essay/task";
import { type BilledCall, meterBilledCalls } from "@zoonk/ai/billed-calls";
import { zoonkDefaultProvider } from "@zoonk/ai/gateway";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { getWritingGrader } from "@zoonk/ai/tasks/grading/grade-essay";
import { getWritingKeyWriter } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { getScoringRowKinds } from "@zoonk/core/exams/essays/writing-sheet";

const [source, output, forecastArg, limitArg, concurrencyArg = "8", keyFile] =
  process.argv.slice(2);

const forecast = Number(forecastArg);
const limit = Number(limitArg);
const concurrency = Number(concurrencyArg);

if (!(source && output && forecast > 0 && limit > 0 && concurrency > 0)) {
  throw new Error("Expected source, output JSONL, forecast per call, spend limit and concurrency.");
}

const file = output;

globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
const grader = getWritingGrader();
const writer = getWritingKeyWriter();
const cohorts = await getCalibrationJobs(source, keyFile);
const frozenKeys = cohorts.some(({ draw }) => draw > 0) ? await readCalibrationKeys(keyFile) : null;

if (
  frozenKeys?.keys.some(
    ({ model, promptRevision }) =>
      model !== writer.model || promptRevision !== writer.promptVersion,
  )
) {
  throw new Error("Keys must use the current writer model and revision.");
}

const previous = existsSync(file)
  ? readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { cost: number; runId: string })
  : [];

const previouslySpent = previous.reduce((sum, run) => sum + run.cost, 0);
const keysRevision = frozenKeys ? getKeysRevision(frozenKeys, source) : null;
const completed = new Set(previous.map(({ runId }) => runId));

const measurableOnly = process.env.WRITING_CALIBRATION_MEASURABLE_ONLY === "1";
const expectedKind = listCalibrationCohorts().find((cohort) => cohort.source === source)?.kind;

const measurable = [...Map.groupBy(cohorts, ({ answer }) => answer).values()]
  .filter((answers) =>
    answers.every(({ input }) => {
      const kinds = getScoringRowKinds(input.basis);
      return kinds.length === 1 && kinds[0] === expectedKind;
    }),
  )
  .flat();

const jobs = (measurableOnly ? measurable : cohorts)
  .flatMap((job) => {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ grader, input: job.input, writer }))
      .digest("hex");

    return Array.from({ length: CALIBRATION_REPEATS }, (_, index) => ({
      ...job,
      fingerprint,
      run: index + 1,
      runId: `${job.source}/${job.answer}/${job.draw}/${index + 1}/${fingerprint}`,
    }));
  })
  .filter(({ runId }) => !completed.has(runId));

process.stdout.write(
  `${source}: ${jobs.length} calls, forecast $${(jobs.length * forecast).toFixed(3)}, limit $${limit}\n`,
);

async function measureJob({ input, ...job }: (typeof jobs)[number]): Promise<number> {
  const billed: BilledCall[] = [];
  const kinds = getScoringRowKinds(input.basis);
  const started = performance.now();

  const recorded = await (async () => {
    try {
      const { data, provenance } = await meterBilledCalls(billed, () =>
        gradeEssayTask.generate({
          ...input,
          model: grader.model,
          reasoning: "high",
          useFallback: false,
        }),
      );

      const { result } = data;

      return {
        estimated: result.kind === "points" ? result.total : null,
        grader: provenance && { model: provenance.model, promptVersion: provenance.promptVersion },
        ignoredFrom: result.ignoredFrom,
        scores:
          result.kind === "points"
            ? result.rows.map(({ earned, id, max }) => ({ earned, id, max }))
            : [],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.name : "UnknownError",
        estimated: null,
        grader: null,
      };
    }
  })();

  const cost = getCallsCost({
    calls: billed.map((call) => toModelCall(call)),
    prices: GATEWAY_PRICES,
  });

  appendFileSync(
    file,
    `${JSON.stringify({
      ...job,
      ...recorded,
      cost,
      ...(keysRevision && { keysRevision }),
      kinds,
      latencyMs: Math.round(performance.now() - started),
      writer,
    })}\n`,
  );

  return cost;
}

async function measureBatches(index: number, spent: number): Promise<void> {
  const batch = jobs.slice(index, index + concurrency);

  if (batch.length === 0 || spent + batch.length * forecast > limit) {
    return;
  }

  const costs = await Promise.all(batch.map((job) => measureJob(job)));
  const total = costs.reduce((sum, cost) => sum + cost, spent);
  const next = index + batch.length;
  process.stdout.write(`${source}: ${next}/${jobs.length}, spent $${total.toFixed(4)}\n`);

  return measureBatches(next, total);
}

await measureBatches(0, previouslySpent);
