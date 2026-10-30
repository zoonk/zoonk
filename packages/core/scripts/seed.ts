import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { prisma } from "@zoonk/db";
import { SEED_PERSONA_NAMES, type SeedPersonaName } from "@zoonk/db/seed/personas";
import { logError } from "@zoonk/utils/logger";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { seed, seedPersonaCopy } from "../src/seed/seed";

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
      `A copy needs a persona (${SEED_PERSONA_NAMES.join("|")}), a copy key and an email, and whole days and an IANA zone when given.`,
    );
  }

  return seedPersonaCopy({ awayDays, copyKey, day: planDay, email, persona, timeZone });
}

type CopyRequest = Parameters<typeof copyPersona>[0] & { id: string };

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
  const { values } = parseArgs({ options: { serve: { type: "boolean" } } });

  if (values.serve) {
    await serveCopies();
    return;
  }

  await seed();
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
