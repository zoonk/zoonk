/**
 * Seeds Zoonk v2 with the plans the planner makes (see `seedV2`), or, with `--persona`, writes a
 * copy of one persona (see `seedV2PersonaCopy`), on `--day` of its plan when given, back after
 * `--away` days without studying when given, living in `--time-zone` instead of its own when given,
 * and prints it as JSON; with `--serve`, it writes copies on request until stdin closes. For
 * processes that can't load core's server code: Prisma's seed command and Playwright run it as
 * `pnpm seed:v2`, which sets the app domain auth reads as core loads (the seed builds no URL). No
 * model is called.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { prisma } from "@zoonk/db";
import { SEED_PERSONA_NAMES, type SeedPersonaName } from "@zoonk/db/seed/v2/personas";
import { logError } from "@zoonk/utils/logger";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { seedV2, seedV2PersonaCopy } from "../src/seed/seed-v2";

function isPersonaName(value: string): value is SeedPersonaName {
  return SEED_PERSONA_NAMES.some((name) => name === value);
}

function toWholeNumber(value: string | undefined): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

async function copyPersona({
  away,
  copyKey,
  day,
  email,
  persona,
  timeZone,
}: {
  away?: string;
  copyKey?: string;
  day?: string;
  email?: string;
  persona: string;
  timeZone?: string;
}) {
  const planDay = toWholeNumber(day);
  const awayDays = toWholeNumber(away);

  if (
    !isPersonaName(persona) ||
    !copyKey ||
    !email ||
    planDay === null ||
    awayDays === null ||
    (timeZone !== undefined && !isValidTimeZone(timeZone))
  ) {
    throw new Error(
      `Usage: pnpm seed:v2 [--serve | --persona <${SEED_PERSONA_NAMES.join("|")}> --copy-key <key> --email <email> [--day <day of its plan>] [--away <days without studying>] [--time-zone <IANA zone>]]`,
    );
  }

  return seedV2PersonaCopy({ awayDays, copyKey, day: planDay, email, persona, timeZone });
}

type CopyRequest = Parameters<typeof copyPersona>[0] & { id: string };

/**
 * Writes persona copies for as long as stdin stays open: a request a line (`copyPersona`'s
 * options and an `id`), answered by a line with the same `id` and the copy or the error. Playwright
 * workers keep one open, so a test's copy doesn't pay for starting this process again, which is
 * nearly all a copy costs.
 */
async function serveCopies() {
  for await (const line of createInterface({ input: process.stdin })) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The E2E fixture writes this exact request shape.
    const request = JSON.parse(line) as CopyRequest;

    const answer = await copyPersona(request).then(
      (copy) => ({ copy, id: request.id }),
      (error: unknown) => ({ error: String(error), id: request.id }),
    );

    process.stdout.write(`${JSON.stringify(answer)}\n`);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      away: { type: "string" },
      "copy-key": { type: "string" },
      day: { type: "string" },
      email: { type: "string" },
      persona: { type: "string" },
      serve: { type: "boolean" },
      "time-zone": { type: "string" },
    },
  });

  if (values.serve) {
    await serveCopies();
    return;
  }

  if (values.persona === undefined) {
    await seedV2();
    return;
  }

  const copy = await copyPersona({
    away: values.away,
    copyKey: values["copy-key"],
    day: values.day,
    email: values.email,
    persona: values.persona,
    timeZone: values["time-zone"],
  });

  process.stdout.write(`${JSON.stringify(copy)}\n`);
}

// The database pool keeps idle connections open for a while: exit as soon as the seed is written.
main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    logError(error);
    await prisma.$disconnect();
    process.exit(1);
  });
