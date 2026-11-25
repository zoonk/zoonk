import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { settleWithConcurrency } from "@/lib/concurrency";
import { getCallsCost } from "@/lib/cost";
import { getMeteredCalls, meterModelCalls } from "@/lib/spend-meter";
import {
  BLIND_KEYS_FILE,
  BLIND_KEY_INSTRUCTIONS,
  type BlindKey,
  type BlindKeyFile,
} from "@/tasks/grade-essay-blind-key/blind-keys";
import {
  SOURCE_QUESTIONS,
  type SourceQuestion,
} from "@/tasks/grade-essay-blind-key/source-questions";
import { zoonkDefaultProvider } from "@zoonk/ai/gateway";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import {
  type WritingPromptInput,
  writeWritingPrompt,
} from "@zoonk/ai/tasks/items/write-writing-prompt";
import { getPromptVersion } from "@zoonk/utils/prompt-version";

function print(line = "") {
  process.stdout.write(`${line}\n`);
}

/** The writer sees only the notice's task and grading, never a candidate's answer or the board's standard, aspects or marks. */
async function writeKey(source: SourceQuestion, draw: number): Promise<BlindKey> {
  const input: WritingPromptInput & { givenContext: string | null; givenQuestion: string } = {
    ...source.writerInput,
    givenContext: source.context,
    givenQuestion: source.question,
  };

  const { data, provenance, systemPrompt } = await writeWritingPrompt({
    appendedInstructions: BLIND_KEY_INSTRUCTIONS,
    input,
    shared: true,
    wait: "soon",
  });

  return {
    copiedQuestion: data.question.trim() === source.question.trim(),
    costUsd: provenance.costUsd ?? null,
    data,
    draw,
    latencyMs: provenance.latencyMs,
    model: provenance.model,
    productionPromptVersion: getPromptVersion({
      systemPrompt: systemPrompt.slice(0, -(BLIND_KEY_INSTRUCTIONS.length + 1)),
    }),
    promptVersion: getPromptVersion({ systemPrompt }),
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

const questionOrder = (id: string) => SOURCE_QUESTIONS.findIndex((source) => source.id === id);

async function main() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
  meterModelCalls();

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { draw: { default: "1", type: "string" } },
  });

  const draw = Number(values.draw);

  if (!Number.isInteger(draw) || draw < 1) {
    throw new Error(`--draw takes a whole number from 1: ${values.draw}`);
  }

  const sources = SOURCE_QUESTIONS.filter(
    ({ id }) => positionals.length === 0 || positionals.includes(id),
  );

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
  const target = path.join(process.cwd(), BLIND_KEYS_FILE);
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
