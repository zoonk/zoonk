import { describeStep } from "@zoonk/ai/task-provenance";
import { Output, type UserContent, generateText } from "ai";
import { getCallCost } from "../cost";
import { toModelCall } from "../types";
import { pricesFor } from "./reader-prices";
import { type Comparison, type PacketOutput, type Reader, blindOutputs } from "./schemas";
import type z from "zod";

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
    process.stderr.write(
      `Seat read for ${reader.model}: the subscription client includes account context. Using gateway.\n`,
    );
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
