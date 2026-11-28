import { readFileSync } from "node:fs";
import { isJsonObject } from "../../../packages/utils/src/json.ts";
import { usageError } from "./errors.ts";
import { commandUsage } from "./help.ts";
import { parseJson } from "./http.ts";

function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw usageError(`Can't read ${path}.`);
  }
}

export function readJsonObject(path: string): Record<string, unknown> {
  const body = parseJson(readText(path));

  if (!isJsonObject(body)) {
    throw usageError(
      `${path} must hold one JSON object: { reason, feedbackId?, changes } or { reason, fixes: [{ changes }] }.`,
    );
  }

  return body;
}

export function requireReason(reason: string | undefined): string {
  if (!reason?.trim()) {
    throw usageError(`"staff fixes revert" needs a reason: ${commandUsage("staff fixes revert")}`);
  }

  return reason;
}

export function fixTarget({
  args,
  batch,
  command,
}: {
  args: string[];
  batch: string | undefined;
  command: string;
}) {
  const [fixId, ...extra] = args;

  if (extra.length > 0 || (fixId === undefined) === (batch === undefined)) {
    throw usageError(
      `"staff fixes ${command}" takes one fix id or --batch <batchId>: ${commandUsage(`staff fixes ${command}`)}`,
    );
  }

  return fixId === undefined ? { batchId: batch } : { fixId };
}
