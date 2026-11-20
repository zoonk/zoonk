import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

export function staffList<Row>(
  model: string,
  {
    fields,
    limit,
    offset = 0,
    order = "id:asc",
    where,
  }: { fields: string; limit: number; offset?: number; order?: string; where: string[] },
): { hasMore: boolean; records: Row[] } {
  const output = execFileSync(
    "pnpm",
    [
      "--silent",
      "zoonk",
      "staff",
      "list",
      model,
      "--fields",
      fields,
      "--limit",
      String(limit),
      "--offset",
      String(offset),
      "--order",
      order,
      ...where.flatMap((filter) => ["--where", filter]),
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    },
  );

  return JSON.parse(output) as { hasMore: boolean; records: Row[] };
}

export function wholeNumber(value: string, max: number, option: string): number {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw new Error(`--${option} must be an integer from 1 to ${max}.`);
  }

  return number;
}

export function isoDate(value: string): string {
  return new Date(value).toISOString();
}
