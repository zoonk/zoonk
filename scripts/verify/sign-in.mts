import { setTimeout as delay } from "node:timers/promises";
import { type APIRequestContext, request } from "@playwright/test";
import { AUTH_BASE_PATH } from "../../apps/api/src/lib/auth-base-path.ts";
import { type Learner } from "./exposure.mts";

type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

const BETTER_AUTH_DEFAULT_BASE_PATH = "/api/auth";
const CODE_TIMEOUT_MS = 15_000;
const CODE_POLL_MS = 500;

type CapturedEmail = { htmlBody?: string; receivedAt: string; textBody?: string; to: string };

async function readCode({
  email,
  mailboxUrl,
  since,
}: {
  email: string;
  mailboxUrl: string;
  since: number;
}): Promise<string> {
  const deadline = Date.now() + CODE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop -- Polls one mailbox until the code arrives.
    const response = await fetch(mailboxUrl);
    // oxlint-disable-next-line no-await-in-loop, typescript/no-unsafe-type-assertion -- The dev mailbox's own response shape.
    const { emails } = (await response.json()) as { emails: CapturedEmail[] };

    const message = emails.find(
      (candidate) => candidate.to === email && Date.parse(candidate.receivedAt) >= since,
    );

    const code = /\b(?<code>\d{6})\b/u.exec(message?.textBody ?? message?.htmlBody ?? "")?.groups
      ?.code;

    if (code) {
      return code;
    }

    // oxlint-disable-next-line no-await-in-loop -- Waits between polls.
    await delay(CODE_POLL_MS);
  }

  throw new Error(`No sign-in code for ${email} reached ${mailboxUrl}.`);
}

function authPath(app: string) {
  return app === "api" ? AUTH_BASE_PATH : BETTER_AUTH_DEFAULT_BASE_PATH;
}

async function post(context: APIRequestContext, url: string, data: Record<string, string>) {
  const response = await context.post(url, { data });

  if (!response.ok()) {
    throw new Error(`${url} failed: ${response.status()} ${await response.text()}`);
  }

  return response;
}

export async function signIn({
  app,
  baseUrl,
  email,
  mailboxUrl,
}: {
  app: string;
  baseUrl: string;
  email: string;
  mailboxUrl: string;
}): Promise<{ learner: Learner; storageState: StorageState }> {
  // Better Auth keeps and mails addresses in lowercase.
  const address = email.trim().toLowerCase();

  const context = await request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: { origin: new URL(baseUrl).origin },
  });

  try {
    const auth = authPath(app);
    const since = Date.now();

    await post(context, `${auth}/email-otp/send-verification-otp`, {
      email: address,
      type: "sign-in",
    });

    const otp = await readCode({ email: address, mailboxUrl, since });
    const response = await post(context, `${auth}/sign-in/email-otp`, { email: address, otp });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Better Auth's own response shape.
    const { user } = (await response.json()) as { user: Learner };

    return {
      learner: { email: user.email, id: user.id, name: user.name },
      storageState: await context.storageState(),
    };
  } finally {
    await context.dispose();
  }
}
