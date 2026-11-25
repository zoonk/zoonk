import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { settleWithConcurrency } from "@/lib/concurrency";
import { getCallsCost } from "@/lib/cost";
import { getMeteredCalls, meterModelCalls } from "@/lib/spend-meter";
import {
  BLIND_KEY_INSTRUCTIONS,
  BLIND_KEYS_FILE,
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

/**
 * Has the production writer (same model chain and prompt) key each real question a board set,
 * from the notice's task and grading alone: never a candidate's answer, the board's standard,
 * its aspects or marks. The one eval-only change is the appended rule to keep the given question.
 */
async function writeKey(source: SourceQuestion): Promise<BlindKey> {
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
    latencyMs: provenance.latencyMs,
    model: provenance.model,
    productionPromptVersion: getPromptVersion({
      systemPrompt: systemPrompt.slice(0, -(BLIND_KEY_INSTRUCTIONS.length + 1)),
    }),
    promptVersion: getPromptVersion({ systemPrompt }),
    questionId: source.id,
  };
}

async function main() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;
  meterModelCalls();

  const only = process.argv.slice(2);
  const sources = SOURCE_QUESTIONS.filter(({ id }) => only.length === 0 || only.includes(id));
  const settled = await settleWithConcurrency({ concurrency: 6, items: sources, run: writeKey });

  const keys = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    console.error(`Failed ${sources[index]?.id}:`, result.reason);
    return [];
  });

  const spent = getCallsCost({ calls: getMeteredCalls(), prices: GATEWAY_PRICES });

  const file: BlindKeyFile = {
    appendedInstructions: BLIND_KEY_INSTRUCTIONS,
    generatedAt: new Date().toISOString(),
    keys,
    spentUsd: spent,
  };

  const target = path.join(process.cwd(), BLIND_KEYS_FILE);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(file, null, 2)}\n`);

  console.log(
    `Wrote ${keys.length}/${sources.length} keys to ${target}; spent $${spent.toFixed(4)}`,
  );

  for (const key of keys) {
    console.log(`${key.questionId}: ${key.model}, copied question ${key.copiedQuestion}`);
  }
}

await main();
