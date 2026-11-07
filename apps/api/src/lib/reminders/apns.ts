import { sign } from "node:crypto";
import { connect } from "node:http2";
import { getEnvironment } from "@zoonk/utils/environment";
import { safeAsync } from "@zoonk/utils/error";
import { getString } from "@zoonk/utils/json";
import { logError } from "@zoonk/utils/logger";
import { type PushOutcome, classifyApnsAnswer } from "./push-outcome";
import { type ReminderText } from "./reminder-copy";

const PRODUCTION_HOST = "https://api.push.apple.com";
const SANDBOX_HOST = "https://api.sandbox.push.apple.com";
const MS_PER_SECOND = 1000;
const REQUEST_TIMEOUT_MS = 10_000;

/** Apple refuses a provider token refreshed more often than every 20 minutes or older than an hour. */
const TOKEN_LIFETIME_MS = 2_400_000;

let cachedToken: { expiresAt: number; token: string } | null = null;

type ApnsConfig = { keyId: string; privateKey: string; teamId: string; topic: string };

function readConfig(): ApnsConfig | null {
  const keyId = process.env.APPLE_APNS_KEY_ID;
  const privateKey = process.env.APPLE_APNS_PRIVATE_KEY?.replaceAll(String.raw`\n`, "\n");
  const teamId = process.env.APPLE_TEAM_ID;
  const topic = process.env.APPLE_APP_BUNDLE_IDENTIFIER;

  return keyId && privateKey && teamId && topic ? { keyId, privateKey, teamId, topic } : null;
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getProviderToken({ keyId, privateKey, teamId }: ApnsConfig): string {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const header = encode({ alg: "ES256", kid: keyId });
  const claims = encode({ iat: Math.floor(Date.now() / MS_PER_SECOND), iss: teamId });
  const unsigned = `${header}.${claims}`;

  const signature = sign("sha256", Buffer.from(unsigned), {
    dsaEncoding: "ieee-p1363",
    key: privateKey,
  });

  const token = `${unsigned}.${signature.toString("base64url")}`;

  cachedToken = { expiresAt: Date.now() + TOKEN_LIFETIME_MS, token };
  return token;
}

type ApnsAnswer = { reason: string | null; retryAfter: string | null; status: number };

/** Apple's error answers carry `{ "reason": "Unregistered" }`; a 200 has no body. */
function readReason(body: string): string | null {
  try {
    return getString(JSON.parse(body), "reason");
  } catch {
    return null;
  }
}

/** APNs only speaks HTTP/2, which `fetch` doesn't. */
function postToApns({
  body,
  headers,
  path,
}: {
  body: string;
  headers: Record<string, string>;
  path: string;
}): Promise<ApnsAnswer> {
  const host = getEnvironment() === "production" ? PRODUCTION_HOST : SANDBOX_HOST;

  return new Promise((resolve, reject) => {
    const session = connect(host);
    session.on("error", reject);

    const request = session.request({ ":method": "POST", ":path": path, ...headers });
    const answer = { body: "", retryAfter: null as string | null, status: 0 };

    request.setEncoding("utf8");
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.close());

    request.on("response", (responseHeaders) => {
      answer.status = Number(responseHeaders[":status"]);
      const retryAfter = responseHeaders["retry-after"];
      answer.retryAfter = typeof retryAfter === "string" ? retryAfter : null;
    });

    request.on("data", (chunk: string) => {
      answer.body += chunk;
    });

    request.on("end", () => {
      session.close();

      resolve({
        reason: readReason(answer.body),
        retryAfter: answer.retryAfter,
        status: answer.status,
      });
    });

    request.on("error", (error) => {
      session.close();
      reject(error);
    });

    request.end(body);
  });
}

/** With no APNs key, sending is skipped; outside production that's expected. */
export async function sendApnsReminder({
  expiresAt,
  goalId,
  text,
  token,
}: {
  expiresAt: Date;
  goalId: string;
  text: ReminderText;
  token: string;
}): Promise<PushOutcome> {
  const config = readConfig();

  if (!config) {
    if (getEnvironment() === "production") {
      logError("APNs isn't configured, so iPhone study reminders aren't sent.");
    }

    return { status: "skipped" };
  }

  const { data, error } = await safeAsync(() =>
    postToApns({
      body: JSON.stringify({
        aps: { alert: text, "interruption-level": "active", sound: "default" },
        goalId,
        type: "study_reminder",
      }),
      headers: {
        "apns-collapse-id": "study-reminder",
        "apns-expiration": String(Math.floor(expiresAt.getTime() / MS_PER_SECOND)),
        "apns-push-type": "alert",
        "apns-topic": config.topic,
        authorization: `bearer ${getProviderToken(config)}`,
      },
      path: `/3/device/${token}`,
    }),
  );

  if (error) {
    logError("APNs study reminder failed", error);
    return { status: "unknown" };
  }

  return classifyApnsAnswer(data);
}
