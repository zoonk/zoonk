import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { checkRuns } from "@/lib/comparisons/checks";
import { decide, decisionSchema } from "@/lib/comparisons/decision";
import { importVerdicts, saveResponse } from "@/lib/comparisons/packets";
import { prepare } from "@/lib/comparisons/prepare";
import { readPacket } from "@/lib/comparisons/readers";
import { formatDecision } from "@/lib/comparisons/report";
import {
  type Manifest,
  type SealedPacket,
  identifier,
  manifestSchema,
  readerSchema,
  responseSchema,
} from "@/lib/comparisons/schemas";
import { directory, loadComparison, readOptional, writeRecord } from "@/lib/comparisons/storage";
import { verifyClaims } from "@/lib/comparisons/verify";
import { runInOrder } from "@/lib/concurrency";
import { getTaskById } from "@/tasks";
import { zoonkDefaultProvider } from "@zoonk/ai/gateway";
import z from "zod";

const string = { type: "string" } as const;
const flag = { type: "boolean" } as const;
const multiple = { multiple: true, type: "string" } as const;

const { values: options } = parseArgs({
  options: {
    attempt: string,
    bank: string,
    case: multiple,
    challenger: string,
    confirm: flag,
    "cost-usd": string,
    export: string,
    id: string,
    import: string,
    incumbent: string,
    "limit-usd": string,
    packet: string,
    question: string,
    reader: multiple,
    runs: string,
    "saved-only": flag,
    "stop-after": string,
    task: string,
  },
});

const taskId = identifier.parse(options.task);
const id = identifier.parse(options.id);
const dir = directory(taskId, id);
const attempt = identifier.parse(options.attempt ?? "first");
globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;

const current = () => loadComparison(taskId, id);

function readers() {
  const defaultReaders = ["seat:anthropic/claude-haiku-5.5", "gateway:openai/gpt-6-luna"];

  if (
    [options.incumbent, options.challenger].some((model) => model?.startsWith("openai/")) &&
    [options.incumbent, options.challenger].some((model) => model?.startsWith("anthropic/"))
  ) {
    defaultReaders.push("gateway:google/gemini-4-neon");
  }

  const selected = (options.reader ?? defaultReaders).map((raw) => {
    const [channel, model] = raw.split(":");
    return readerSchema.parse({ channel, family: model?.split("/")[0], model });
  });

  if (
    new Set(selected.map((reader) => reader.family)).size !== selected.length ||
    selected.some((reader) => reader.family === "owner" || reader.channel === "owner")
  ) {
    throw new Error(
      "Specify one model reader per family. The owner packet is added automatically.",
    );
  }

  if (
    selected.some((reader) => reader.family === "google" && reader.model !== "google/gemini-4-neon")
  ) {
    throw new Error("Use Gemini 4 Neon for the Google reader.");
  }

  if (
    !["anthropic", "openai"].every((family) => selected.some((reader) => reader.family === family))
  ) {
    throw new Error("Include Claude and GPT readers.");
  }

  return [...selected, { channel: "owner", family: "owner", model: "owner" } as const];
}

async function exchange(manifest: Manifest) {
  const available = manifest.packets.filter((packet) => packet.reader.channel !== "seat");
  const packet = available.find((entry) => entry.id === options.packet);

  if (!packet) {
    throw new Error(
      `Select a --packet from ${JSON.stringify(
        available.map((entry) => ({
          case: entry.mapping[0]?.caseId,
          id: entry.id,
          reader: entry.reader,
          reverse: entry.reverse,
        })),
      )}`,
    );
  }

  if (options.export) {
    await fs.writeFile(
      options.export,
      JSON.stringify(
        {
          packet: packet.packet,
          protocol: manifest.protocols.reader,
          schema: z.toJSONSchema(responseSchema),
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
  }

  if (options.import) {
    const args = {
      attempt,
      id,
      packetId: packet.id,
      response: JSON.parse(await fs.readFile(options.import, "utf8")) as unknown,
      taskId,
    };

    if (packet.reader.channel === "owner") {
      await importVerdicts(args);
    } else {
      await saveResponse(
        args,
        z.coerce.number().nonnegative().parse(options["cost-usd"]),
        "gateway",
      );
    }
  }
}

async function readOne(packet: SealedPacket, protocol: string) {
  const { response, costUsd, channel } = await readPacket({
    packet: JSON.stringify(packet.packet),
    protocol,
    reader: packet.reader,
    schema: responseSchema,
  });

  const saved = await saveResponse(
    { attempt, id, packetId: packet.id, response, taskId },
    costUsd,
    channel,
  );

  process.stdout.write(
    `${JSON.stringify({
      costUsd,
      packet: packet.id,
      passed: saved.passed,
      reader: saved.reader,
    })}\n`,
  );
}

async function readOrder(reverse: boolean, reserve = false) {
  const comparison = await loadComparison(taskId, id);
  const { manifest } = comparison;
  const unresolved = decide(comparison).cases.filter((entry) => entry.result === "unresolved");

  const pending = manifest.packets.filter((packet) => {
    if (Boolean(packet.reader.reserve) !== reserve) {
      return false;
    }

    if (packet.reverse !== reverse || packet.reader.channel === "owner") {
      return false;
    }

    if (
      (reverse || reserve) &&
      !unresolved.some((entry) => entry.caseId === packet.mapping[0]?.caseId)
    ) {
      return false;
    }

    return !comparison.attempts.some(
      (stored) => stored.packetId === packet.id && (stored.passed || stored.attempt === attempt),
    );
  });

  const first = pending.at(0);

  if (options["stop-after"] === "packet" && first) {
    await readOne(first, manifest.protocols.reader);
    return true;
  }

  await runInOrder(pending, (packet) => readOne(packet, manifest.protocols.reader));

  return false;
}

async function getManifest() {
  const task = getTaskById(taskId);

  if (!task) {
    throw new Error("Unknown task.");
  }

  return prepare({
    bank: options.bank ?? task.id,
    caseIds: options.case ?? [],
    challenger: options.challenger ?? "",
    confirm: options.confirm ?? false,
    generate: !options["saved-only"],
    id,
    incumbent: options.incumbent,
    limit: z.coerce
      .number()
      .nonnegative()
      .parse(options["limit-usd"] ?? 1),
    question: options.question ?? "Which variant better serves the learner?",
    readers: readers(),
    runs: z.coerce
      .number()
      .int()
      .positive()
      .parse(options.runs ?? 2),
    stopAfterFreeze: options["stop-after"] === "freeze",
    task,
  });
}

async function run() {
  const manifest =
    (await readOptional(path.join(dir, "manifest.json"), manifestSchema)) ?? (await getManifest());

  if (!manifest || options["stop-after"] === "seal") {
    return;
  }

  if (options.export || options.import) {
    await exchange(manifest);
    return;
  }

  if (!(await readOptional(path.join(dir, "checks-complete.json"), z.literal(true)))) {
    const task = getTaskById(taskId);

    if (!task) {
      throw new Error("The frozen checks have not completed and the task is unavailable.");
    }

    await checkRuns(task, await current());
  }

  if (options["stop-after"] === "checks") {
    return;
  }

  const checked = await current();

  if (
    !decide(checked).rows.some(
      (reader) => reader.side === "challenger" && reader.status === "disqualified",
    )
  ) {
    const interrupted = await readOrder(false);

    if (interrupted || (await readOrder(true)) || (await readOrder(true, true))) {
      return;
    }

    if (options["stop-after"] === "reads") {
      return;
    }

    await verifyClaims(await current(), attempt);
  }

  const comparison = await current();
  const decision = decide(comparison);
  await writeRecord(path.join(dir, "decision.json"), decisionSchema, decision, true);
  process.stdout.write(formatDecision(decision, comparison));
}

await fs.mkdir(dir, { recursive: true });
const marker = path.join(dir, `running-${process.pid}`);
await fs.writeFile(marker, "");

try {
  const files = await fs.readdir(dir);

  const occupied = files.some((name) => {
    const match = /^running-(?<pid>\d+)$/u.exec(name);

    if (!match || name === path.basename(marker)) {
      return false;
    }

    try {
      process.kill(Number(match.groups?.pid), 0);
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH") {
        return false;
      }

      throw error;
    }
  });

  if (occupied) {
    throw new Error("Another process is running this comparison.");
  }

  await run();
} finally {
  await fs.unlink(marker);
}
