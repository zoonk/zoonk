/**
 * Seeds Zoonk v2 with the plans the planner makes (see `seedV2`), or, with `--persona`, writes a
 * copy of one persona (see `seedV2PersonaCopy`), on `--day` of its plan when given, back after
 * `--away` days without studying when given, and prints it as JSON. For processes that can't
 * load core's server code: Prisma's seed command and Playwright run it as `pnpm seed:v2`, which
 * sets the app domain auth reads as core loads (the seed builds no URL). No model is called.
 */
import { parseArgs } from "node:util";
import { prisma } from "@zoonk/db";
import { SEED_PERSONA_NAMES, type SeedPersonaName } from "@zoonk/db/seed/v2/personas";
import { logError } from "@zoonk/utils/logger";
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
}: {
  away?: string;
  copyKey?: string;
  day?: string;
  email?: string;
  persona: string;
}) {
  const planDay = toWholeNumber(day);
  const awayDays = toWholeNumber(away);

  if (!isPersonaName(persona) || !copyKey || !email || planDay === null || awayDays === null) {
    throw new Error(
      `Usage: pnpm seed:v2 [--persona <${SEED_PERSONA_NAMES.join("|")}> --copy-key <key> --email <email> [--day <day of its plan>] [--away <days without studying>]]`,
    );
  }

  const copy = await seedV2PersonaCopy({ awayDays, copyKey, day: planDay, email, persona });
  process.stdout.write(`${JSON.stringify(copy)}\n`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      away: { type: "string" },
      "copy-key": { type: "string" },
      day: { type: "string" },
      email: { type: "string" },
      persona: { type: "string" },
    },
  });

  if (values.persona === undefined) {
    await seedV2();
    return;
  }

  await copyPersona({
    away: values.away,
    copyKey: values["copy-key"],
    day: values.day,
    email: values.email,
    persona: values.persona,
  });
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
