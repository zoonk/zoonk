/** Run it through `pnpm dev:persona`, which passes the URLs `pnpm dev` serves. */
import { parseArgs } from "node:util";
import { prisma } from "@zoonk/db";
import { SEED_LANGUAGES, type SeedLanguage } from "@zoonk/db/seed/v2/localize";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { logError, logInfo } from "@zoonk/utils/logger";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { MAIN_URL } from "@zoonk/utils/url";
import {
  type PersonaCloneRequest,
  type PersonaRequest,
  clonePersona,
  createPersona,
  listPersonaNames,
} from "./_utils/personas";
import { getTestLearnerRefusal } from "./_utils/test-learners";

const USAGE = [
  "Usage: pnpm dev:persona <name> [--day <n>] [--away <days>] [--plus|--free] [--tz <zone>] [--locale en|pt]",
  "       pnpm dev:persona --from <email> [--day <n> | --away <days>] [--plus|--free] [--tz <zone>]",
].join("\n");

function parseWholeNumber(
  value: string | undefined,
  { min, name }: { min: number; name: string },
): number | undefined {
  if (value === undefined) {
    return;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number < min) {
    throw new Error(`--${name} takes a whole number from ${min}, not "${value}".`);
  }

  return number;
}

function parsePlus({ free, plus }: { free?: boolean; plus?: boolean }): boolean | undefined {
  if (plus && free) {
    throw new Error("Pick --plus or --free, not both.");
  }

  return plus || (free ? false : undefined);
}

function isSeedLanguage(value: string): value is SeedLanguage {
  return SEED_LANGUAGES.some((language) => language === value);
}

type ParsedRequest =
  | { kind: "clone"; request: PersonaCloneRequest }
  | { kind: "seeded"; request: PersonaRequest };

function parseRequest(): ParsedRequest {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      away: { type: "string" },
      day: { type: "string" },
      free: { type: "boolean" },
      from: { type: "string" },
      locale: { type: "string" },
      plus: { type: "boolean" },
      tz: { type: "string" },
    },
  });

  const [name] = positionals;

  if (values.tz !== undefined && !isValidTimeZone(values.tz)) {
    throw new Error(`--tz takes a time zone such as America/Sao_Paulo, not "${values.tz}".`);
  }

  const options = {
    awayDays: parseWholeNumber(values.away, { min: 0, name: "away" }),
    day: parseWholeNumber(values.day, { min: 1, name: "day" }),
    plus: parsePlus(values),
    timeZone: values.tz,
  };

  if (values.from !== undefined) {
    if (name || values.locale !== undefined) {
      throw new Error("--from copies a learner as they are: pass no persona name or --locale.");
    }

    return { kind: "clone", request: { ...options, from: values.from } };
  }

  if (!name) {
    throw new Error(`${USAGE}\nPersonas: ${listPersonaNames().join(", ")}.`);
  }

  if (values.locale !== undefined && !isSeedLanguage(values.locale)) {
    throw new Error(`--locale takes ${SEED_LANGUAGES.join(" or ")}, not "${values.locale}".`);
  }

  return {
    kind: "seeded",
    request: { ...options, language: values.locale, name: name.toLowerCase() },
  };
}

function daysSince(date: Date, timeZone: string): number {
  const day = (moment: Date) => getDateInTimeZone({ date: moment, timeZone }).getTime();

  return Math.round((day(new Date()) - day(date)) / MS_PER_DAY);
}

function describeLastStudy(endedAt: Date | null | undefined, timeZone: string): string {
  if (!endedAt) {
    return "hasn't studied yet";
  }

  const days = daysSince(endedAt, timeZone);

  if (days === 0) {
    return "last studied today";
  }

  return days === 1 ? "last studied yesterday" : `last studied ${days} days ago`;
}

async function describePersona({ email, goalId }: { email: string; goalId: string }) {
  const goal = await prisma.goal.findUniqueOrThrow({
    include: { user: true },
    where: { id: goalId },
  });

  const [plus, lastStudy] = await Promise.all([
    prisma.subscription.count({ where: { referenceId: goal.userId, status: "active" } }),
    prisma.learningEvent.findFirst({
      orderBy: { endedAt: "desc" },
      where: { endedAt: { not: null }, userId: goal.userId },
    }),
  ]);

  const timeZone = goal.timezone ?? "UTC";
  const localePath = goal.language === DEFAULT_LOCALE ? "" : `/${goal.language}`;
  const mailbox = process.env.MAILBOX_URL ? new URL(process.env.MAILBOX_URL).origin : null;

  return [
    `${goal.user.name}: ${goal.title} (${goal.kind}), ${plus > 0 ? "Plus" : "Free"}, ${timeZone}, ${goal.language}`,
    `Today is day ${daysSince(goal.createdAt, timeZone) + 1} of the plan; ${describeLastStudy(lastStudy?.endedAt, timeZone)}.`,
    "",
    `Sign in: open ${MAIN_URL}${localePath}/login, enter ${email} and type the code sent to it (newest message in the dev mailbox${mailbox ? `, ${mailbox}` : ""}).`,
    `Then open ${MAIN_URL}${localePath}`,
    "Remove it with every other test learner: pnpm dev:remove-test-learners --yes",
  ].join("\n");
}

function describeClone({ from, movedDays }: { from: string; movedDays: number }): string {
  if (movedDays === 0) {
    return `Copied from ${from}.`;
  }

  const days = Math.abs(movedDays) === 1 ? "1 day" : `${Math.abs(movedDays)} days`;
  const direction = movedDays > 0 ? "later" : "earlier";

  return `Copied from ${from}, with every date ${days} ${direction}: the goal's date and the weekdays it studies moved too.`;
}

async function writePersona() {
  const refusal = getTestLearnerRefusal();

  if (refusal) {
    throw new Error(`Refusing to write a persona: ${refusal}`);
  }

  const parsed = parseRequest();

  if (parsed.kind === "seeded") {
    const { email, goalId } = await createPersona(parsed.request);
    logInfo(await describePersona({ email, goalId }));
    return;
  }

  const { email, goalId, movedDays } = await clonePersona(parsed.request);
  const description = await describePersona({ email, goalId });

  logInfo(`${describeClone({ from: parsed.request.from, movedDays })}\n${description}`);
}

try {
  await writePersona();
} catch (error) {
  logError(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
