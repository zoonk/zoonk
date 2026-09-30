import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { type ExperienceMode, prisma } from "@zoonk/db";
import { seedV2PersonaCopy } from "@zoonk/db/seed/v2";
import { type E2EUser } from "./users";

const SHORT_UUID_LENGTH = 8;

/** The v2 seed's password, shared by every persona and its copies. */
const PERSONA_PASSWORD = "password123";

type PersonaName = Parameters<typeof seedV2PersonaCopy>[1]["persona"];

export type E2EPersona = E2EUser & { goalId: string };

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

  const storageState = await context.storageState();
  await context.dispose();

  return storageState;
}

/**
 * A private copy of a v2 seed persona (`v2-*@zoonk.test`), with the same goal, plan, history and
 * memory, in the mode the test asks for. Tests that change a learner's data use a copy, so the
 * shared personas stay the same for tests that only read them.
 */
export async function createE2EPersona(
  baseURL: string,
  { mode, persona }: { mode?: ExperienceMode; persona: PersonaName },
): Promise<E2EPersona> {
  const copyKey = randomUUID().slice(0, SHORT_UUID_LENGTH);
  const email = `e2e-${persona.toLowerCase()}-${copyKey}@zoonk.test`;

  const { goalId, userId } = await seedV2PersonaCopy(prisma, { copyKey, email, mode, persona });
  const storageState = await signIn({ baseURL, email });

  return { email, goalId, id: userId, password: PERSONA_PASSWORD, storageState };
}
