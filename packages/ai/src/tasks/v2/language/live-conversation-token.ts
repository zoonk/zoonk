import "server-only";
import { getGatewayRealtimeProtocols } from "@ai-sdk/gateway";
import { z } from "zod";
import { isTestEnvironment } from "../../../_utils/is-test-environment";
import { LIVE_CONVERSATION_MODEL } from "./live-conversation-models";

const CLIENT_SECRETS_URL = "https://ai-gateway.vercel.sh/v1/realtime/client-secrets";
const LIVE_SESSIONS_URL = "wss://ai-gateway.vercel.sh/v1/live/sessions";
const MINT_TIMEOUT_MS = 10_000;

const liveSecretSchema = z.object({ expiresAt: z.number().optional(), token: z.string().min(1) });

/**
 * What the browser needs to open the call itself: the Live WebSocket URL and
 * the subprotocols that carry the single-use token. Its first event is
 * `session.start` with this model.
 */
export type LiveConversationConnection = {
  expiresAt: number | null;
  model: string;
  protocols: string[];
  token: string;
  url: string;
};

/**
 * Mints a short-lived, single-use token so the browser talks to GPT-Live
 * directly and our gateway key never leaves the server. The gateway SDK's
 * `getToken` can't mint a Live token, so this calls the documented
 * client-secrets endpoint with `routeKind: "live"`. Callers authenticate the
 * learner and claim the conversation's usage first.
 */
export async function createLiveConversationToken(): Promise<LiveConversationConnection> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (isTestEnvironment() || !apiKey) {
    throw new Error("Live conversation tokens need AI_GATEWAY_API_KEY outside tests.");
  }

  const response = await fetch(CLIENT_SECRETS_URL, {
    body: JSON.stringify({ model: LIVE_CONVERSATION_MODEL, routeKind: "live" }),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Could not create a Live token (${response.status}).`);
  }

  const secret = liveSecretSchema.parse(await response.json());

  return {
    expiresAt: secret.expiresAt ?? null,
    model: LIVE_CONVERSATION_MODEL,
    protocols: getGatewayRealtimeProtocols(secret.token),
    token: secret.token,
    url: LIVE_SESSIONS_URL,
  };
}
