import { setTimeout as delay } from "node:timers/promises";
import { type APIRequestContext, request } from "@playwright/test";

type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

const AUTH = "/api/auth";
const CODE_TIMEOUT_MS = 15_000;
const CODE_POLL_MS = 500;

type CapturedEmail = { htmlBody?: string; receivedAt: string; textBody?: string; to: string };

/** The newest sign-in code the dev mailbox received for `email` since `since`. */
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

async function post(context: APIRequestContext, path: string, data: Record<string, string>) {
  const response = await context.post(`${AUTH}${path}`, { data });

  if (!response.ok()) {
    throw new Error(`${path} failed: ${response.status()} ${await response.text()}`);
  }
}

/**
 * Signs `email` in through Main's real auth API, with the code the dev mailbox receives (on
 * `pnpm dev` and `pnpm start` alike), and returns the session as Playwright storage state.
 */
export async function signIn({
  baseUrl,
  email,
  mailboxUrl,
}: {
  baseUrl: string;
  email: string;
  mailboxUrl: string;
}): Promise<StorageState> {
  // Better Auth keeps and mails addresses in lowercase.
  const address = email.trim().toLowerCase();

  const context = await request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: { origin: new URL(baseUrl).origin },
  });

  try {
    const since = Date.now();
    await post(context, "/email-otp/send-verification-otp", { email: address, type: "sign-in" });
    const otp = await readCode({ email: address, mailboxUrl, since });
    await post(context, "/sign-in/email-otp", { email: address, otp });

    return await context.storageState();
  } finally {
    await context.dispose();
  }
}
