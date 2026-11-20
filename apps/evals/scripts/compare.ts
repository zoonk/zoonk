import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { checkRuns } from "@/lib/comparisons/checks";
import { decide, decisionSchema } from "@/lib/comparisons/decision";
import { importVerdicts, ownerPackets, saveResponse } from "@/lib/comparisons/packets";
import { prepare } from "@/lib/comparisons/prepare";
import { imageContent, readPacket } from "@/lib/comparisons/readers";
import { formatDecision } from "@/lib/comparisons/report";
import {
  type Comparison,
  type Manifest,
  type SealedPacket,
  identifier,
  manifestSchema,
  ownerResponseSchema,
  readerSchema,
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

const usage = `Usage: pnpm --filter evals eval:compare --task <task> --id <id> [options]

  --challenger <model>     Challenger: model, model@<variant hash>, model@current to generate, or sealed:<comparison id>:<incumbent|challenger>
  --incumbent <model>      Incumbent, in the same forms; omit for a single-output audit
  --case <id>              Limit to a case (repeatable)
  --runs <n>               Runs per case (default 2)
  --reader <channel:model> A reader such as seat:anthropic/claude-haiku-5.5 (repeatable, one per family)
  --bank <name>            Control bank in eval-results/controls (default: the task id)
  --question <text>        The question the comparison answers
  --limit-usd <amount>     Stop when the forecast passes this amount (default 1)
  --confirm                Go past the forecast limit
  --saved-only             Use saved outputs only, never generate
  --stop-after <stage>     freeze, seal, checks, packet or reads
  --attempt <name>         Attempt label for reads and imports (default first)
  --packet <id>            Packet to export or import
  --export <file>          Write the packet, protocol and response schema to a new file
  --import <file>          Import a response for --packet
  --cost-usd <amount>      Measured cost of an imported model response
  --help                   Show this help
`;

const { values: options } = parseArgs({
  options: {
    attempt: string,
    bank: string,
    case: multiple,
    challenger: string,
    confirm: flag,
    "cost-usd": string,
    export: string,
    help: flag,
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

const current = () => loadComparison(taskId, id);

function readers(image: boolean) {
  const defaultReaders = [
    `${image ? "gateway" : "seat"}:anthropic/claude-haiku-5.5`,
    "gateway:openai/gpt-6-luna",
  ];

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

async function readOne(packet: SealedPacket, { manifest, outputs }: Comparison) {
  const { pairs, ...header } = packet.packet;

  const { response, costUsd, channel } = await readPacket({
    content: imageContent({ entries: pairs, header, identify: (entry) => entry.pairId, outputs }),
    packet: JSON.stringify(packet.packet),
    protocol: manifest.protocols.reader,
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
      ...(saved.failureCodes && { failureCodes: saved.failureCodes, failures: saved.failures }),
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
    await readOne(first, comparison);
    return true;
  }

  await runInOrder(pending, (packet) => readOne(packet, comparison));

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
    readers: readers(task.output === "image"),
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
