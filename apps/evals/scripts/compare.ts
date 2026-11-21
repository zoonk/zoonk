import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { checkRuns } from "@/lib/comparisons/checks";
import {
  decide,
  decisionSchema,
  decisiveUnresolved,
  needsModelReads,
} from "@/lib/comparisons/decision";
import {
  DEFAULT_RESERVE_READ_CAP,
  confirmForecast,
  forecastReader,
  forecastReads,
} from "@/lib/comparisons/forecast";
import { importVerdicts, ownerPackets, saveResponse } from "@/lib/comparisons/packets";
import { prepare } from "@/lib/comparisons/prepare";
import {
  additionalReaders,
  assertReaderPlan,
  modelReader,
} from "@/lib/comparisons/reader-selection";
import { imageContent, readPacket } from "@/lib/comparisons/readers";
import { formatDecision } from "@/lib/comparisons/report";
import {
  type Comparison,
  type Manifest,
  type SealedPacket,
  identifier,
  manifestSchema,
  ownerResponseSchema,
  responseSchema,
} from "@/lib/comparisons/schemas";
import {
  directory,
  loadComparison,
  readBlob,
  readOptional,
  writeRecord,
} from "@/lib/comparisons/storage";
import { verifyClaims } from "@/lib/comparisons/verify";
import { runInOrder } from "@/lib/concurrency";
import { getTaskById } from "@/tasks";
import { zoonkDefaultProvider } from "@zoonk/ai/gateway";
import z from "zod";

const string = { type: "string" } as const;
const flag = { type: "boolean" } as const;
const multiple = { multiple: true, type: "string" } as const;
const DEFAULT_CLAUDE_READER = "anthropic/claude-haiku-5.5";
const DEFAULT_GPT_READER = "openai/gpt-6-luna";

const usage = `Usage: pnpm --filter evals eval:compare --task <task> --id <id> [options]

  --challenger <model>     Challenger: model, model@<variant hash>, model@current to generate, or sealed:<comparison id>:<incumbent|challenger>
  --incumbent <model>      Incumbent, in the same forms; omit for a single-output audit
  --case <id>              Limit to a case (repeatable)
  --runs <n>               Runs per case (default 2)
  --reader <channel:model> A reader such as gateway:anthropic/claude-haiku-5.5 (repeatable, one per family)
  --claude-reader <model> Full Anthropic model ID (default ${DEFAULT_CLAUDE_READER}, seat first for text packets)
                         Set CLAUDE_CONFIG_DIR to choose the Claude login.
                         Claude includes the subscription's account identity. Receipts record its presence and managed settings keys.
                         If limited, wait for a reset within four hours. Otherwise, print the reason and use the gateway.
  --gpt-reader <model>    Full OpenAI model ID (default ${DEFAULT_GPT_READER})
                         Choose models that passed the control packets. Use --reader to choose channels.
  --reserve <model|none>   Choose the third gateway reader, or skip optional reads with none
                          Claude–GPT comparisons always require a third family
  --reserve-cap <n>        Maximum optional reads across attempts (default ${DEFAULT_RESERVE_READ_CAP})
  --seal-only              Freeze and seal saved outputs for free, without generation or reads
  --bank <name>            Control bank in eval-results/controls (default: the task id)
  --question <text>        The question the comparison answers
  --limit-usd <amount>     Stop when the forecast passes this amount (default 1)
  --confirm                Go past the forecast limit
  --saved-only             Use saved outputs only, never generate
  --stop-after <stage>     freeze, seal, checks, packet or reads
  --attempt <name>         Attempt label for reads and imports (default first)
  --packet <id>            Packet to export or import
  --export <file>          Write the packet, protocol and response schema to a new file
  --import <file>          Import the owner's response for --packet
  --help                   Show this help
`;

const { values: options } = parseArgs({
  options: {
    attempt: string,
    bank: string,
    case: multiple,
    challenger: string,
    "claude-reader": string,
    confirm: flag,
    export: string,
    "gpt-reader": string,
    help: flag,
    id: string,
    import: string,
    incumbent: string,
    "limit-usd": string,
    packet: string,
    question: string,
    reader: multiple,
    reserve: string,
    "reserve-cap": string,
    runs: string,
    "saved-only": flag,
    "seal-only": flag,
    "stop-after": string,
    task: string,
  },
});

if (options.help) {
  process.stdout.write(usage);
  // oxlint-disable-next-line no-process-exit -- The rest of the script needs a task and an id.
  process.exit(0);
}

const taskId = identifier.parse(options.task);
const id = identifier.parse(options.id);
const dir = directory(taskId, id);
const attempt = identifier.parse(options.attempt ?? "first");
globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkDefaultProvider;

const limit = z.coerce
  .number()
  .nonnegative()
  .parse(options["limit-usd"] ?? 1);

const reserveCap = z.coerce.number().int().nonnegative().optional().parse(options["reserve-cap"]);
const current = () => loadComparison(taskId, id);

const stopAfter = z
  .enum(["freeze", "seal", "checks", "packet", "reads"])
  .optional()
  .parse(options["stop-after"]);

const claudeReader = z
  .string()
  .regex(/^anthropic\/[\w.-]+$/u)
  .optional()
  .parse(options["claude-reader"]);

const gptReader = z
  .string()
  .regex(/^openai\/[\w.-]+$/u)
  .optional()
  .parse(options["gpt-reader"]);

if (options.reader && (claudeReader || gptReader)) {
  throw new Error("Choose --reader or the family-specific reader options.");
}

const readerOptions = options.reader?.map((raw) => {
  const [channel, model, extra] = raw.split(":");

  if (extra !== undefined) {
    throw new Error("Specify a reader as seat:provider/model or gateway:provider/model.");
  }

  return modelReader(channel, model);
});

function readers(image: boolean) {
  const selected = readerOptions ?? [
    modelReader(image ? "gateway" : "seat", claudeReader ?? DEFAULT_CLAUDE_READER),
    modelReader("gateway", gptReader ?? DEFAULT_GPT_READER),
  ];

  return [...selected, { channel: "owner", family: "owner", model: "owner" } as const];
}

async function exchange(manifest: Manifest) {
  const available = [
    ...manifest.packets.filter((packet) => packet.reader.channel === "gateway"),
    ...ownerPackets(manifest),
  ];

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

  if (options.import && packet.reader.channel !== "owner") {
    throw new Error(
      "Only owner responses can be imported. Run model readers through eval:compare.",
    );
  }

  if (options.export) {
    const owner = packet.reader.channel === "owner";

    const keys = new Set(
      packet.packet.pairs.flatMap((pair) =>
        [pair.A, pair.B].flatMap((item) => (item && typeof item !== "string" ? [item.image] : [])),
      ),
    );

    const images = Object.fromEntries(
      await Promise.all(
        [...keys].map(async (key) => {
          const data = await readBlob(dir, key);
          return [key, `data:image/webp;base64,${data.toString("base64")}`] as const;
        }),
      ),
    );

    await fs.writeFile(
      options.export,
      JSON.stringify(
        {
          ...(Object.keys(images).length > 0 ? { images } : {}),
          packet: packet.packet,
          protocol: owner
            ? `${manifest.protocols.reader}\nFor the owner’s read, give one overall reason. Reasons per criterion are optional.\n`
            : manifest.protocols.reader,
          schema: z.toJSONSchema(owner ? ownerResponseSchema : responseSchema),
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
  }

  if (options.import) {
    await importVerdicts({
      attempt,
      id,
      packetId: packet.id,
      response: JSON.parse(await fs.readFile(options.import, "utf8")) as unknown,
      taskId,
    });
  }
}

async function readOne(packet: SealedPacket, { manifest, outputs }: Comparison) {
  if (packet.reader.reserve) {
    await fs.writeFile(path.join(dir, "reserve-reads", `${packet.id}-${attempt}`), "", {
      flag: "wx",
    });
  }

  const { pairs, ...header } = packet.packet;

  const { response, ...receipt } = await readPacket({
    content: imageContent({ entries: pairs, header, identify: (entry) => entry.pairId, outputs }),
    packet: JSON.stringify(packet.packet),
    protocol: manifest.protocols.reader,
    reader: packet.reader,
    schema: responseSchema,
  });

  const saved = await saveResponse({ attempt, id, packetId: packet.id, response, taskId }, receipt);

  process.stdout.write(
    `${JSON.stringify({
      costUsd: saved.costUsd,
      packet: packet.id,
      passed: saved.passed,
      ...(saved.failureCodes && { failureCodes: saved.failureCodes, failures: saved.failures }),
      reader: saved.reader,
      seatContext: saved.seatContext,
    })}\n`,
  );

  return saved;
}

async function reserveStarts(comparison: Comparison) {
  const folder = path.join(dir, "reserve-reads");
  await fs.mkdir(folder, { recursive: true });
  const started = new Set(await fs.readdir(folder));

  for (const record of comparison.attempts.filter((entry) => entry.reader.reserve)) {
    started.add(`${record.packetId}-${record.attempt}`);
  }

  return started;
}

function activeReserveCap(manifest: Manifest) {
  const frozen = manifest.reserveCap ?? DEFAULT_RESERVE_READ_CAP;
  return Math.min(frozen, reserveCap ?? frozen);
}

async function readOrder(comparison: Comparison, reverse: boolean, reserve = false) {
  if (!needsModelReads(comparison)) {
    return false;
  }

  const { manifest } = comparison;
  const decisive = reserve ? new Set(decisiveUnresolved(comparison)) : null;
  const unresolved = decide(comparison).cases.filter((entry) => entry.result === "unresolved");

  const started = reserve ? await reserveStarts(comparison) : new Set<string>();

  const pending = manifest.packets.filter((packet) => {
    if (
      decisive &&
      (!decisive.has(packet.mapping[0]?.caseId ?? "") || started.has(`${packet.id}-${attempt}`))
    ) {
      return false;
    }

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

  const cap = activeReserveCap(manifest);

  const used = started.size;

  const available = reserve ? pending.slice(0, Math.max(0, cap - used)) : pending;

  const first = available.at(0);

  if (stopAfter === "packet" && first) {
    await readOne(first, comparison);
    return true;
  }

  await runInOrder(available, async (packet) => {
    if (!needsModelReads(comparison)) {
      return;
    }

    if (reserve && !decisiveUnresolved(await current()).includes(packet.mapping[0]?.caseId ?? "")) {
      return;
    }

    comparison.attempts.push(await readOne(packet, comparison));
  });

  return false;
}

async function readPackets(comparison: Comparison) {
  return (
    (await readOrder(comparison, false)) ||
    (await readOrder(comparison, true)) ||
    (options.reserve !== "none" && (await readOrder(comparison, true, true)))
  );
}

async function evidenceStep(attempted: Set<string>) {
  const comparison = await current();
  const reads = comparison.attempts.length;

  if ((await readPackets(comparison)) || stopAfter === "packet" || stopAfter === "reads") {
    return "stop";
  }

  const checked = comparison.attempts.length === reads ? comparison : await current();
  const previous = checked.verifications.length;
  await verifyClaims(checked, attempt, attempted);

  return checked.verifications.length !== previous && needsModelReads(checked)
    ? "read again"
    : "report";
}

async function collectEvidence() {
  const attempted = new Set<string>();

  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- A saved verification can make another read decisive.
    const next = await evidenceStep(attempted);

    if (next !== "read again") {
      return next === "stop";
    }
  }
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
    confirm: Boolean(options.confirm || options["seal-only"]),
    generate: !options["saved-only"] && !options["seal-only"],
    id,
    incumbent: options.incumbent,
    limit,
    question: options.question ?? "Which variant better serves the learner?",
    readers: readers(task.output === "image"),
    reserve: options.reserve,
    reserveCap: reserveCap ?? DEFAULT_RESERVE_READ_CAP,
    runs: z.coerce
      .number()
      .int()
      .positive()
      .parse(options.runs ?? 2),
    sealOnly: options["seal-only"],
    stopAfterFreeze: stopAfter === "freeze",
    task,
  });
}

async function forecastFirstRead(manifest: Manifest, needsForecast: boolean) {
  const comparison = needsForecast && !options.confirm ? await current() : null;

  const selected = manifest.readers.filter(
    (reader) => !reader.reserve || options.reserve !== "none",
  );

  if (
    !comparison ||
    (!options["limit-usd"] &&
      comparison.attempts.some((record) => record.reader.channel !== "owner"))
  ) {
    const cap = activeReserveCap(manifest);

    process.stdout.write(
      `${JSON.stringify({ forecast: { readers: selected.map((reader) => forecastReader(reader)), reserveCap: cap } })}\n`,
    );

    return;
  }

  const byReader = await forecastReads(
    { ...manifest, readers: selected, reserveCap: activeReserveCap(manifest) },
    manifest.runsCompared,
    new Map(Object.entries(comparison.outputs)),
    Boolean(manifest.variants.incumbent),
    false,
  );

  confirmForecast(byReader, 0, limit, false);
}

function checkReaderConfiguration(manifest: Manifest) {
  assertReaderPlan({
    challenger: manifest.variants.challenger.model,
    incumbent: manifest.variants.incumbent?.model,
    readers: manifest.readers,
  });

  if (
    options.reserve &&
    options.reserve !== "none" &&
    !additionalReaders(manifest.readers).some((reader) => reader.model === options.reserve)
  ) {
    throw new Error(
      "The chosen third reader differs from this sealed comparison. Start a new comparison to change readers.",
    );
  }

  if (
    [claudeReader, gptReader].some(
      (model) =>
        model && !manifest.readers.some((reader) => !reader.reserve && reader.model === model),
    ) ||
    readerOptions?.some(
      ({ channel, model }) =>
        !manifest.readers.some((reader) => reader.channel === channel && reader.model === model),
    )
  ) {
    throw new Error(
      "The chosen reader differs from this sealed comparison. Start a new comparison to change readers.",
    );
  }
}

async function run() {
  const sealed = await readOptional(path.join(dir, "manifest.json"), manifestSchema);

  if (!sealed && (options.export || options.import)) {
    throw new Error("Seal the comparison before exchanging packets.");
  }

  const manifest = sealed ?? (await getManifest());

  if (!manifest || options["seal-only"] || stopAfter === "freeze" || stopAfter === "seal") {
    return;
  }

  checkReaderConfiguration(manifest);

  if (options.export || options.import) {
    await exchange(manifest);
    return;
  }

  if (stopAfter !== "checks") {
    await forecastFirstRead(manifest, sealed !== null);
  }

  if (
    manifest.requiresAnswerKeyCheck ||
    !(await readOptional(path.join(dir, "checks-complete.json"), z.literal(true)))
  ) {
    await checkRuns(getTaskById(taskId), await current());
  }

  if (stopAfter === "checks") {
    return;
  }

  if (await collectEvidence()) {
    return;
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
