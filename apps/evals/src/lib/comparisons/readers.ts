import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describeStep } from "@zoonk/ai/task-provenance";
import { Output, type UserContent, generateText } from "ai";
import z from "zod";
import { getCallCost } from "../cost";
import { toModelCall } from "../types";
import { pricesFor } from "./reader-prices";
import { type Comparison, type PacketOutput, type Reader, blindOutputs } from "./schemas";

async function claude(args: string[], cwd: string, input: string) {
  const child = spawn("claude", args, {
    cwd,
    env: {
      HOME: os.homedir(),
      LANG: "en_US.UTF-8",
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
  child.stderr.resume();

  const done = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });

  child.stdin.on("error", () => {
    /* empty */
  });

  child.stdin.end(input);
  const code = await done;
  const stdout = Buffer.concat(chunks).toString();

  if (code !== 0 && !stdout.trim()) {
    throw new Error("Claude subscription client failed.");
  }

  return stdout;
}

async function seatRead<T>(reader: Reader, protocol: string, packet: string, schema: z.ZodType<T>) {
  if (reader.family !== "anthropic") {
    throw new Error("This seat cannot be qualified as tool-free. Use its gateway channel.");
  }

  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "eval-seat-"));

  try {
    const auth = z.object({
      authMethod: z.literal("claude.ai"),
      loggedIn: z.literal(true),
      subscriptionType: z.string().min(1),
    });

    auth.parse(JSON.parse(await claude(["auth", "status"], cwd, "")));
    const model = reader.model.replace(/^anthropic\//u, "").replaceAll(".", "-");

    const output = await claude(
      [
        "-p",
        "--safe-mode",
        "--restricted",
        "--disable-slash-commands",
        "--tools",
        "",
        "--strict-mcp-config",
        "--setting-sources",
        "",
        "--no-session-persistence",
        "--model",
        model,
        "--system-prompt",
        protocol,
        "--output-format",
        "stream-json",
        "--verbose",
      ],
      cwd,
      `${packet}\nReturn only JSON matching ${JSON.stringify(z.toJSONSchema(schema))}`,
    );

    const events = z.array(z.looseObject({ type: z.string() })).parse(
      output
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as unknown),
    );

    const init = events.find((event) => event.subtype === "init");

    z.object({
      apiKeySource: z.literal("none"),
      mcp_servers: z.tuple([]),
      model: z.literal(model),
      plugins: z.array(z.object({ path: z.literal("builtin") })),
      tools: z.tuple([]),
    }).parse(init);

    const result = z
      .object({
        is_error: z.boolean(),
        modelUsage: z.record(z.string(), z.unknown()),
        result: z.string(),
      })
      .parse(events.find((event) => event.type === "result"));

    const limits = events
      .filter((event) => event.type === "rate_limit_event")
      .map((event) =>
        z
          .object({ resetsAt: z.number().optional(), status: z.string() })
          .safeParse(event.rate_limit_info),
      );

    const reset = limits.findLast((limit) => limit.success && limit.data.status === "rejected")
      ?.data?.resetsAt;

    if (result.is_error && reset) {
      throw new SeatLimitError(result.result, reset * 1000);
    }

    if (result.is_error) {
      throw new Error(result.result);
    }

    if (!Object.hasOwn(result.modelUsage, model)) {
      throw new Error("Seat response used a different model.");
    }

    return {
      channel: "seat" as const,
      costUsd: 0,
      response: schema.parse(JSON.parse(result.result)),
    };
  } finally {
    await fs.rm(cwd, { force: true, recursive: true });
  }
}

class SeatLimitError extends Error {
  readonly resetsAt: number;
  constructor(message: string, resetsAt: number) {
    super(message);
    this.name = "SeatLimitError";
    this.resetsAt = resetsAt;
  }
}

function attached(item: PacketOutput) {
  return typeof item === "string" ? item : "See attached image.";
}

export function imageContent<T extends ReturnType<typeof blindOutputs>>({
  entries,
  header,
  identify,
  outputs,
}: {
  entries: T[];
  header?: object;
  identify: (entry: T) => string;
  outputs: Comparison["outputs"];
}): UserContent | undefined {
  const images = entries.flatMap((entry) =>
    (["A", "B"] as const).flatMap((label) => {
      const item = entry[label];

      if (!item || typeof item === "string") {
        return [];
      }

      const bytes = outputs[item.image];

      if (!Buffer.isBuffer(bytes)) {
        throw new TypeError("Missing archived packet image.");
      }

      return [
        { text: `Image ${label} for ${identify(entry)}:`, type: "text" as const },
        { data: bytes, mediaType: "image/webp", type: "file" as const },
      ];
    }),
  );

  if (images.length === 0) {
    return undefined;
  }

  const brief = entries.map((entry) => ({
    ...entry,
    ...blindOutputs(attached(entry.A), entry.B === null ? null : attached(entry.B)),
  }));

  return [
    { text: JSON.stringify(header ? { ...header, pairs: brief } : brief), type: "text" },
    ...images,
  ];
}

export async function readPacket<T>({
  reader,
  protocol,
  packet,
  content,
  schema,
}: {
  reader: Reader;
  protocol: string;
  packet: string;
  content?: UserContent;
  schema: z.ZodType<T>;
}) {
  if (reader.channel === "owner") {
    throw new Error("Import the owner’s blind read.");
  }

  if (reader.channel === "seat") {
    if (content) {
      throw new TypeError("Image packets require gateway model readers.");
    }

    try {
      return await seatRead(reader, protocol, packet, schema);
    } catch (error) {
      if (
        error instanceof SeatLimitError &&
        error.resetsAt > Date.now() &&
        error.resetsAt - Date.now() <= 4 * 60 * 60 * 1000
      ) {
        process.stdout.write(
          `Waiting for the reader subscription reset at ${new Date(
            error.resetsAt,
          ).toISOString()}\n`,
        );

        await new Promise((resolve) => {
          setTimeout(resolve, error.resetsAt - Date.now());
        });

        return seatRead(reader, protocol, packet, schema);
      }

      process.stderr.write(
        `Subscription unavailable or unqualified. Using gateway for ${reader.model}\n`,
      );
    }
  }

  const prices = await pricesFor([reader.model]);

  const result = await generateText({
    instructions: protocol,
    maxRetries: 0,
    model: reader.model,
    output: Output.object({ schema }),
    ...(content ? { messages: [{ content, role: "user" as const }] } : { prompt: packet }),
  });

  const costUsd = result.steps.reduce(
    (total, step) => total + getCallCost({ ...toModelCall(describeStep(step)), prices }),
    0,
  );

  return { channel: "gateway" as const, costUsd, response: result.output };
}
