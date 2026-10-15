import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { type SeedPersonaName } from "@zoonk/db/seed/v2/personas";
import { seedV2PersonaCopy } from "./seed-v2";
import { withSessionHint } from "./session-hint";
import { type E2EUser } from "./users";

const SHORT_UUID_LENGTH = 8;

/** The v2 seed's password, shared by every persona and its copies. */
const PERSONA_PASSWORD = "password123";

/** A persona's copy, with its goal and the time zone it lives in (its goal's). */
export type E2EPersona = E2EUser & { goalId: string; timeZone: string };

/** Signs in through the real auth API, so cookies and sessions match production. */
async function signIn({ baseURL, email }: { baseURL: string; email: string }) {
  const context = await request.newContext({ baseURL });

  const response = await context.post("/api/auth/sign-in/email", {
    data: { email, password: PERSONA_PASSWORD },
  });

  if (!response.ok()) {
    const body = await response.text();
    await context.dispose();
    throw new Error(`Sign-in failed for ${email}: ${response.status()} - ${body}`);
  }

  const storageState = withSessionHint(await context.storageState());
  await context.dispose();

  return storageState;
}

/**
 * A private copy of a v2 seed persona (`v2-*@zoonk.test`), with the same goal, plan, history and
 * memory, on its own day of its plan or on `day` of it (day 1 is the day the plan was made), back
 * after `away` days without studying when given (day 7 after 6 away: set up, never studied), living
 * in `timeZone` instead of its own when given (its days are that zone's).
 * Tests that change a learner's data use a copy, so the shared personas stay the same for tests
 * that only read them.
 */
export async function createE2EPersona(
  baseURL: string,
  {
    away,
    day,
    persona,
    timeZone,
  }: { away?: number; day?: number; persona: SeedPersonaName; timeZone?: string },
): Promise<E2EPersona> {
  const copyKey = randomUUID().slice(0, SHORT_UUID_LENGTH);
  const email = `e2e-${persona.toLowerCase()}-${copyKey}@zoonk.test`;

  const { goalId, userId } = await seedV2PersonaCopy({
    away,
    copyKey,
    day,
    email,
    persona,
    timeZone,
  });

  const [storageState, goal] = await Promise.all([
    signIn({ baseURL, email }),
    prisma.goal.findUniqueOrThrow({ select: { timezone: true }, where: { id: goalId } }),
  ]);

  return {
    email,
    goalId,
    id: userId,
    password: PERSONA_PASSWORD,
    storageState,
    timeZone: goal.timezone ?? "UTC",
  };
}
