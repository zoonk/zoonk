import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { describeStep } from "@zoonk/ai/task-provenance";
import { Output, type UserContent, generateText } from "ai";
import z from "zod";
import { getCallCost } from "../cost";
import { toModelCall } from "../types";
import { pricesFor } from "./reader-prices";
import { type Comparison, type PacketOutput, type Reader, blindOutputs } from "./schemas";

async function claude(args: string[], cwd: string, input = "") {
  const child = spawn("claude", args, {
    cwd,
    env: {
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
      HOME: os.homedir(),
      LANG: "en_US.UTF-8",
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH,
      USER: process.env.USER,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
  const errors: Buffer[] = [];
  child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));

  const done = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });

  child.stdin.on("error", () => null);

  child.stdin.end(input);
  const code = await done;
  const stdout = Buffer.concat(chunks).toString();

  if (code !== 0 && !stdout.trim()) {
    throw new Error(
      `Claude subscription client exited ${code}: ${Buffer.concat(errors).toString().trim()}`,
    );
  }

  return { code, stdout };
}

const subscriptionFlags = ["--safe-mode", "--restricted", "--setting-sources", ""];

async function qualifySubscription(cwd: string) {
  const { code, stdout } = await claude([...subscriptionFlags, "auth", "status"], cwd);

  const status = z
    .object({
      apiProvider: z.literal("firstParty"),
      authMethod: z.literal("claude.ai"),
      configDirectory: z.string().min(1),
      loggedIn: z.literal(true),
      subscriptionType: z.string().min(1),
    })
    .safeParse(JSON.parse(stdout));

  if (code !== 0 || !status.success) {
    throw new Error("The client did not authenticate with a first-party Claude subscription.");
  }

  return status.data.configDirectory;
}

async function absentOnMissing<T>(read: Promise<T>) {
  try {
    return await read;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function policyKeys(policy: string | null) {
  if (policy === null) {
    return [];
  }

  try {
    return Object.keys(z.record(z.string(), z.unknown()).parse(JSON.parse(policy)));
  } catch {
    throw new Error("Could not inspect Claude managed settings.");
  }
}

async function managedSettingsKeys(configDirectory: string) {
  const mac = process.platform === "darwin";

  if (!mac && process.platform !== "linux") {
    throw new Error("Managed settings cannot be checked on this platform.");
  }

  const policyDir = mac ? "/Library/Application Support/ClaudeCode" : "/etc/claude-code";
  const dropIns = path.join(policyDir, "managed-settings.d");
  const domain = "com.anthropic.claudecode.plist";

  const [files, managedMcp, ...policyProfiles] = await Promise.all([
    absentOnMissing(fs.readdir(dropIns)),
    absentOnMissing(fs.lstat(path.join(policyDir, "managed-mcp.json"))),
    ...(mac
      ? [
          `/Library/Managed Preferences/${domain}`,
          `/Library/Managed Preferences/${os.userInfo().username}/${domain}`,
          `/Library/Preferences/${domain}`,
          path.join(os.homedir(), "Library", "Preferences", domain),
        ].map((file) => absentOnMissing(fs.lstat(file)))
      : []),
  ]);

  if (policyProfiles.some(Boolean)) {
    throw new Error("Claude has an OS policy profile whose settings could not be qualified.");
  }

  if (managedMcp) {
    throw new Error("Claude has a managed MCP configuration.");
  }

  const policies = await Promise.all(
    [
      path.join(configDirectory, "remote-settings.json"),
      path.join(policyDir, "managed-settings.json"),
      ...(files ?? [])
        .filter((file) => !file.startsWith(".") && file.endsWith(".json"))
        .map((file) => path.join(dropIns, file)),
    ].map((file) => absentOnMissing(fs.readFile(file, "utf8"))),
  );

  const keys = [...new Set(policies.flatMap((policy) => policyKeys(policy)))].toSorted();

  // Channel servers require a session opt-in. https://code.claude.com/docs/en/channels
  const unqualified = keys.filter((key) => key !== "channelsEnabled");

  if (unqualified.length > 0) {
    throw new Error(`Claude managed settings could change the read: ${unqualified.join(", ")}.`);
  }

  return keys;
}

class SeatLimitError extends Error {
  readonly resetsAt: number | undefined;

  constructor(resetsAt: number | undefined) {
    super(
      resetsAt
        ? `Seat limited until ${new Date(resetsAt).toISOString()}.`
        : "Seat limited with no reset time.",
    );

    this.name = "SeatLimitError";
    this.resetsAt = resetsAt;
  }
}

type SeatInput<T> = { model: string; packet: string; protocol: string; schema: z.ZodType<T> };

async function seatRead<T>({ model, packet, protocol, schema }: SeatInput<T>) {
  const cwd = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), "eval-seat-"));

  try {
    const configDirectory = await qualifySubscription(cwd);
    const policyBefore = await managedSettingsKeys(configDirectory);
    const cliModel = model.replace(/^anthropic\//u, "").replaceAll(".", "-");

    const { code, stdout } = await claude(
      [
        "-p",
        ...subscriptionFlags,
        "--disable-slash-commands",
        "--include-hook-events",
        "--max-turns",
        "1",
        "--no-chrome",
        "--no-session-persistence",
        "--strict-mcp-config",
        "--tools",
        "",
        "--model",
        cliModel,
        "--system-prompt",
        protocol,
        "--output-format",
        "stream-json",
        "--verbose",
      ],
      cwd,
      `${packet}\nReturn only JSON matching ${JSON.stringify(z.toJSONSchema(schema))}`,
    );

    const policyAfter = await managedSettingsKeys(configDirectory);

    const events = z.array(z.looseObject({ type: z.string() })).parse(
      stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as unknown),
    );

    const init = z
      .object({
        apiKeySource: z.literal("none"),
        cwd: z.literal(cwd),
        mcp_servers: z.tuple([]),
        model: z.literal(cliModel),
        plugins: z.array(z.object({ path: z.literal("builtin") })),
        skills: z.tuple([]),
        tools: z.tuple([]),
      })
      .safeParse(events.find((event) => event.type === "system" && event.subtype === "init"));

    if (!init.success || events.some((event) => String(event.subtype).startsWith("hook_"))) {
      throw new Error(
        "Seat initialization failed the model, authentication, tools, MCP, skills, plugins or hooks check.",
      );
    }

    const result = z
      .object({
        is_error: z.boolean(),
        modelUsage: z.record(z.string(), z.unknown()),
        result: z.string().optional(),
        subtype: z.string(),
      })
      .parse(events.find((event) => event.type === "result"));

    const limited = events
      .filter((event) => event.type === "rate_limit_event")
      .map((event) =>
        z
          .object({
            resetsAt: z.number().positive().max(8.64e12).optional(),
            status: z.literal("rejected"),
          })
          .safeParse(event.rate_limit_info),
      )
      .findLast((limit) => limit.success);

    if ((result.is_error || code !== 0) && limited?.success) {
      throw new SeatLimitError(limited.data.resetsAt && limited.data.resetsAt * 1000);
    }

    if (result.is_error || code !== 0 || !result.result) {
      throw new Error(`Claude read failed (${result.subtype}, exit ${code}).`);
    }

    if (Object.keys(result.modelUsage).join(",") !== cliModel) {
      throw new Error("Seat response used a different model.");
    }

    const response = schema.safeParse(JSON.parse(result.result));

    if (!response.success) {
      throw new Error("Claude returned JSON outside the response schema.");
    }

    return {
      channel: "seat" as const,
      costUsd: 0,
      response: response.data,
      seatContext: {
        accountIdentity: "present" as const,
        managedSettings: [...new Set([...policyBefore, ...policyAfter])].toSorted(),
      },
    };
  } finally {
    await fs.rm(cwd, { force: true, recursive: true });
  }
}

async function readSeatWithReset<T>(input: SeatInput<T>) {
  try {
    return await seatRead(input);
  } catch (error) {
    if (!(error instanceof SeatLimitError) || !error.resetsAt) {
      throw error;
    }

    const waitMs = error.resetsAt - Date.now();

    if (waitMs <= 0 || waitMs > 4 * 60 * 60 * 1000) {
      throw error;
    }

    process.stderr.write(
      `Seat read for ${input.model}: waiting for the subscription reset at ${new Date(error.resetsAt).toISOString()}.\n`,
    );

    await setTimeout(Math.max(0, error.resetsAt - Date.now()));
    return seatRead(input);
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
    try {
      if (reader.family !== "anthropic" || content) {
        throw new Error("The subscription client is qualified for Claude text packets only.");
      }

      return await readSeatWithReset({ model: reader.model, packet, protocol, schema });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown seat failure.";
      process.stderr.write(`Seat read for ${reader.model}: ${reason} Using gateway.\n`);
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

  const calls = result.steps.map((step) => toModelCall(describeStep(step)));

  if (calls.length === 0 || calls.some((call) => call.modelId.split("/")[0] !== reader.family)) {
    throw new Error(`The gateway did not serve the configured reader family (${reader.family}).`);
  }

  const costUsd = calls.reduce((total, call) => total + getCallCost({ ...call, prices }), 0);

  return { channel: "gateway" as const, costUsd, response: result.output, seatContext: undefined };
}
