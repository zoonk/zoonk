import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { meUpdateSchema } from "@/lib/openapi/schemas/me";
import { auth } from "@zoonk/core/auth";
import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import {
  getProfileUpdateErrorResponse,
  getUserUpdateBody,
  hasUserUpdateBody,
} from "./_utils/me-profile-update";
import { createMeResponse } from "./_utils/me-response";

/**
 * Reads the current session from the source session token instead of the cached
 * user cookie so `/v1/me` immediately reflects profile updates.
 */
async function getCurrentSession(headers: Headers) {
  return auth.api.getSession({ headers, query: { disableCookieCache: true } });
}

/**
 * Mirrors the main app's subscription lookup: Better Auth decides which row is
 * active, then Prisma reads the app-owned provider field from that row.
 */
async function getCurrentSubscription(headers: Headers) {
  const activeSubscription = await getActiveSubscription(headers);

  if (!activeSubscription) {
    return null;
  }

  return prisma.subscription.findUnique({ where: { id: activeSubscription.id } });
}

/**
 * Combines the current auth profile with billing state in one response so
 * native clients can bootstrap account UI with a single authenticated request.
 */
async function getMeResponse({
  headers,
  session,
}: {
  headers: Headers;
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;
}) {
  const subscription = await getCurrentSubscription(headers);
  return NextResponse.json(createMeResponse({ session, subscription }));
}

/**
 * Exposes the signed-in user's profile and account state to native clients.
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession(request.headers);

  if (!session) {
    return errors.unauthorized();
  }

  return getMeResponse({ headers: request.headers, session });
}

/**
 * Updates the signed-in user's public profile using the same Better Auth path
 * as the main app, including username validation and uniqueness checks.
 */
export async function PATCH(request: NextRequest) {
  const session = await getCurrentSession(request.headers);

  if (!session) {
    return errors.unauthorized();
  }

  const parsed = await parseBody(request, meUpdateSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const body = getUserUpdateBody({ currentUsername: session.user.username, profile: parsed.data });

  if (!hasUserUpdateBody(body)) {
    return getMeResponse({ headers: request.headers, session });
  }

  const { error } = await safeAsync(() => auth.api.updateUser({ body, headers: request.headers }));

  if (error) {
    return getProfileUpdateErrorResponse(error);
  }

  const updatedSession = await getCurrentSession(request.headers);

  if (!updatedSession) {
    return errors.unauthorized();
  }

  return getMeResponse({ headers: request.headers, session: updatedSession });
}
