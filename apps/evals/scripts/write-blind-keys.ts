import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { settleWithConcurrency } from "@/lib/concurrency";
import { getCallsCost } from "@/lib/cost";
import { getMeteredCalls, meterModelCalls } from "@/lib/spend-meter";
import {
  BLIND_KEY_INSTRUCTIONS,
  type BlindKey,
  type BlindKeyFile,
} from "@/tasks/grade-essay/blind-keys";
import { CALIBRATION_KEYS_PATH } from "@/tasks/grade-essay/calibration-cases";
import { SAF_KEY_SOURCES } from "@/tasks/grade-essay/cases/saf";
import { SOURCE_QUESTIONS, type SourceQuestion } from "@/tasks/grade-essay/cases/source-questions";
import { zoonkDefaultProvider } from "@zoonk/ai/gateway";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import {
  type WritingPromptInput,
  getWritingKeyWriter,
  writeWritingPrompt,
} from "@zoonk/ai/tasks/items/write-writing-prompt";

function print(line = "") {
  process.stdout.write(`${line}\n`);
}

async function writeKey(
  source: Pick<SourceQuestion, "context" | "id" | "question" | "writerInput">,
  draw: number,
): Promise<BlindKey> {
  const input: WritingPromptInput & { givenContext: string | null; givenQuestion: string } = {
    ...source.writerInput,
    givenContext: source.context,
    givenQuestion: source.question,
  };

  const { data, provenance } = await writeWritingPrompt({
    appendedInstructions: BLIND_KEY_INSTRUCTIONS,
    input,
    shared: true,
    useFallback: false,
    wait: "soon",
  });

  return {
    copiedQuestion: data.question.trim() === source.question.trim(),
    costUsd: provenance.costUsd ?? null,
    data,
    draw,
    latencyMs: provenance.latencyMs,
    model: provenance.model,
    promptRevision: getWritingKeyWriter().promptVersion,
    questionId: source.id,
  };
}

async function readSaved(target: string): Promise<BlindKeyFile | null> {
  try {
    return JSON.parse(await readFile(target, "utf8")) as BlindKeyFile;
  } catch {
    return null;
  }
}

async function main() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
  meterModelCalls();

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      draw: { default: "1", type: "string" },
      output: { default: CALIBRATION_KEYS_PATH, type: "string" },
    },
  });

  const draw = Number(values.draw);

  if (!Number.isInteger(draw) || draw < 1) {
    throw new Error(`--draw takes a whole number from 1: ${values.draw}`);
  }

  const available = [...SOURCE_QUESTIONS, ...SAF_KEY_SOURCES];

  const sources = available.filter(
    ({ id }) => positionals.length === 0 || positionals.includes(id),
  );

  const questionOrder = (id: string) => available.findIndex((source) => source.id === id);

  const settled = await settleWithConcurrency({
    concurrency: 6,
    items: sources,
    run: (source) => writeKey(source, draw),
  });

  const keys = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    process.stderr.write(`${[`Failed ${sources[index]?.id}:`, result.reason].join(" ")}\n`);
    return [];
  });

  const spent = getCallsCost({ calls: getMeteredCalls(), prices: GATEWAY_PRICES });
  const target = path.resolve(values.output);
  const saved = await readSaved(target);
  const written = new Set(keys.map(({ questionId }) => questionId));

  const kept = (saved?.keys ?? []).filter(
    (key) => key.draw !== draw || !written.has(key.questionId),
  );

  const file: BlindKeyFile = {
    appendedInstructions: BLIND_KEY_INSTRUCTIONS,
    generatedAt: new Date().toISOString(),
    keys: [...kept, ...keys].toSorted(
      (a, b) => a.draw - b.draw || questionOrder(a.questionId) - questionOrder(b.questionId),
    ),
    spentUsd: (saved?.spentUsd ?? 0) + spent,
  };

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(file, null, 2)}\n`);

  print(
    `Wrote draw ${draw} for ${keys.length}/${sources.length} questions to ${target}; spent $${spent.toFixed(4)}`,
  );

  for (const key of keys) {
    print(`${key.questionId}: ${key.model}, copied question ${key.copiedQuestion}`);
  }
}

await main();
