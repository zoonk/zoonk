import { randomUUID } from "node:crypto";
import { seedV2PersonaCopy } from "@zoonk/core/seed/v2";
import { prisma } from "@zoonk/db";
import { seedV2Plus } from "@zoonk/db/seed/v2";
import { type SeedLanguage } from "@zoonk/db/seed/v2/localize";
import { findSeedPersonaName, listSeedPersonas } from "@zoonk/db/seed/v2/personas";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, getTimeZoneOffsetMs } from "@zoonk/utils/time-zone";
import { type TimeShift, findLastWrite, writeLearnerCopy } from "./copy-learner";
import { readLearner } from "./learner-rows";
import { ONBOARDED_PREFIX } from "./test-learners";

const COPY_KEY_LENGTH = 6;

/** Usernames take at most 30 characters: `persona_`, the name, `_` and the copy key. */
const USERNAME_NAME_LENGTH = 15;

const LAST_WRITE_MARGIN_MS = 60_000;

export type PersonaRequest = {
  name: string;
  /** Day 1 is the day the plan was made. */
  day?: number;
  awayDays?: number;
  plus?: boolean;
  timeZone?: string;
  language?: SeedLanguage;
};

export type PersonaCloneRequest = Omit<PersonaRequest, "language" | "name"> & { from: string };

export function listPersonaNames(): string[] {
  return listSeedPersonas({ now: new Date() })
    .filter((learner) => !learner.isAnonymous)
    .map((learner) => learner.key)
    .toSorted();
}

/**
 * Not a seed email, so `remove-test-learners` removes it, and a username lets sign-in go straight
 * to the app.
 */
function newPersonaAccount(name: string) {
  const copyKey = randomUUID().slice(0, COPY_KEY_LENGTH);

  return {
    copyKey,
    email: `persona-${name}-${copyKey}@zoonk.test`,
    username: `persona_${name.slice(0, USERNAME_NAME_LENGTH).replaceAll("-", "_")}_${copyKey}`,
  };
}

export async function createPersona({ name, ...options }: PersonaRequest) {
  const persona = findSeedPersonaName(name);

  if (!persona) {
    throw new Error(`There's no persona "${name}". Pick one of: ${listPersonaNames().join(", ")}.`);
  }

  return seedV2PersonaCopy({ ...options, ...newPersonaAccount(name), persona });
}

function getCloneName(email: string): string {
  const [local = ""] = email.toLowerCase().split("@");
  const prefix = [ONBOARDED_PREFIX, "persona-"].find((start) => local.startsWith(start)) ?? "";

  const name = local
    .slice(prefix.length)
    .replaceAll(/[^a-z\d]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

  return name || "learner";
}

function toDayNumber(date: Date, timeZone: string): number {
  return Math.round(getDateInTimeZone({ date, timeZone }).getTime() / MS_PER_DAY);
}

/** A clone can't be on a day before its source's last change: what the source did by then is real. */
function getCloneShift({
  awayDays,
  day,
  email,
  lastWrite,
  now,
  planStart,
  sourceTimeZone,
  timeZone,
}: {
  awayDays?: number;
  day?: number;
  email: string;
  lastWrite: Date;
  now: Date;
  planStart: Date;
  sourceTimeZone: string;
  timeZone: string;
}): TimeShift {
  if (day !== undefined && awayDays !== undefined) {
    throw new Error(
      "A copy has no history after its source's, so --day already sets the days away: pass --day or --away.",
    );
  }

  const firstDay = toDayNumber(planStart, sourceTimeZone);
  const lastDay = toDayNumber(lastWrite, sourceTimeZone) - firstDay + 1;
  const targetDay = day ?? lastDay + (awayDays ?? 0);

  if (targetDay < lastDay) {
    throw new Error(
      `${email} last changed on day ${lastDay} of their plan, so a copy can be on day ${lastDay} or later.`,
    );
  }

  const days = toDayNumber(now, timeZone) - (targetDay - 1) - firstDay;

  const zoneMs =
    getTimeZoneOffsetMs({ date: lastWrite, timeZone: sourceTimeZone }) -
    getTimeZoneOffsetMs({ date: lastWrite, timeZone });

  const moved = days * MS_PER_DAY + zoneMs;
  const excess = Math.max(0, lastWrite.getTime() + moved - (now.getTime() - LAST_WRITE_MARGIN_MS));

  return { days, ms: moved - excess };
}

async function findSource(email: string) {
  const source = await prisma.user.findUnique({
    include: {
      goals: { include: { plan: true }, orderBy: { createdAt: "desc" } },
      subscriptions: { where: { status: "active" } },
    },
    where: { email: email.toLowerCase() },
  });

  if (!source || source.isAnonymous) {
    throw new Error(`There's no learner with the email ${email} on this database.`);
  }

  const goal = source.goals.find((candidate) => candidate.plan);

  if (!goal) {
    throw new Error(`${email} has no plan yet: finish their onboarding first.`);
  }

  return { goal, plus: source.subscriptions.length > 0, userId: source.id };
}

export async function clonePersona({ awayDays, day, from, plus, timeZone }: PersonaCloneRequest) {
  const source = await findSource(from);
  const learner = await readLearner(source.userId);
  const now = new Date();

  const sourceTimeZone = source.goal.timezone ?? "UTC";

  const shift = getCloneShift({
    awayDays,
    day,
    email: from,
    lastWrite: findLastWrite(learner),
    now,
    planStart: source.goal.createdAt,
    sourceTimeZone,
    timeZone: timeZone ?? sourceTimeZone,
  });

  const { email, username } = newPersonaAccount(getCloneName(from));
  const userId = await writeLearnerCopy({ account: { email, username }, learner, shift, timeZone });

  if (plus ?? source.plus) {
    await seedV2Plus(prisma, { now, userId });
  }

  const goal = await prisma.goal.findFirstOrThrow({
    orderBy: { createdAt: "desc" },
    where: { plan: { isNot: null }, userId },
  });

  return { email, goalId: goal.id, movedDays: shift.days, userId };
}
