import "server-only";
import { createHash } from "node:crypto";
import { isUuid } from "@zoonk/utils/uuid";
import { headers } from "next/headers";
import { hasActiveSubscription } from "../auth/subscription";
import { getSession } from "../users/get-session";
import { GENERATION_VISITOR_ID_HEADER, type GenerationQuotaViewer } from "./contract";

type GenerationQuotaViewerContext = { actorKey: string; viewer: GenerationQuotaViewer };

/** Selects the original client address while keeping proxy header parsing out of the stored quota key. */
function getClientAddress(requestHeaders: Headers): string {
  const forwardedAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-real-ip") ??
    forwardedAddress ??
    "unknown"
  );
}

/**
 * Provides a privacy-preserving fallback for API clients that do not persist a
 * visitor ID. The database never receives a raw IP address or user-agent value.
 */
function getRequestFingerprint(requestHeaders: Headers): string {
  const fingerprintParts = [
    getClientAddress(requestHeaders),
    requestHeaders.get("user-agent") ?? "unknown",
    requestHeaders.get("accept-language") ?? "unknown",
    requestHeaders.get("sec-ch-ua-platform") ?? "unknown",
  ];

  return createHash("sha256").update(fingerprintParts.join("\n")).digest("hex");
}

/** Prefers the browser's durable random ID so unrelated learners on one shared network keep separate quotas. */
function getGuestActorKey(requestHeaders: Headers): string {
  const visitorId = requestHeaders.get(GENERATION_VISITOR_ID_HEADER);

  if (visitorId && isUuid(visitorId)) {
    return `guest:${visitorId}`;
  }

  return `request:${getRequestFingerprint(requestHeaders)}`;
}

/** Derives identity and entitlement from the request instead of trusting a caller-selected user or plan. */
export async function getGenerationQuotaViewer(): Promise<GenerationQuotaViewerContext> {
  const [requestHeaders, session] = await Promise.all([headers(), getSession()]);

  if (!session) {
    return { actorKey: getGuestActorKey(requestHeaders), viewer: "guest" };
  }

  const viewer = (await hasActiveSubscription()) ? "subscriber" : "authenticated";

  return { actorKey: `user:${session.user.id}`, viewer };
}
