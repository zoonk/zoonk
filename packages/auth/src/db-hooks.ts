import { prisma } from "@zoonk/db";
import { isCountryCode } from "@zoonk/utils/countries";
import { safeAsync } from "@zoonk/utils/error";
import { getString } from "@zoonk/utils/json";
import { getIpCountry } from "@zoonk/utils/locale-request";
import { type GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import { type SignInMethod, reportAuthEvent } from "./auth-events";
import { NAME_MAX_LENGTH, NAME_TOO_LONG_ERROR_CODE, isNameTooLong } from "./name-rules";
import { type UserCreateAfterHook } from "./user-create-hooks";

/**
 * Checked on every write of a name, since Better Auth's own update endpoint doesn't go through core.
 * That endpoint passes any JSON value to the database, where an object like `{ set }` still writes.
 */
export function rejectInvalidName(name: unknown) {
  if (name === undefined) {
    return;
  }

  if (typeof name !== "string") {
    throw new APIError("BAD_REQUEST", { message: "Send the name as text." });
  }

  if (isNameTooLong(name)) {
    throw new APIError("BAD_REQUEST", {
      code: NAME_TOO_LONG_ERROR_CODE,
      message: `Use ${NAME_MAX_LENGTH} characters or fewer for your name.`,
    });
  }
}

export const ensureUserProgressAfterAuthCreate: UserCreateAfterHook = async (user) => {
  await prisma.userProgress.upsert({
    create: { lastActiveAt: user.createdAt ?? new Date(), userId: user.id },
    update: {},
    where: { userId: user.id },
  });
};

/**
 * Where a learner lives starts as the country they signed in from, so nobody has to say it. Only
 * an empty one is filled: a country the learner picked stays, and staff looking at an account as
 * its learner leave it alone. A sign-in never fails over it; a country it couldn't save is filled
 * at the next sign-in.
 */
export async function rememberHomeCountryAfterSessionCreate(
  session: { impersonatedBy?: string | null; userId: string },
  context: GenericEndpointContext | null,
): Promise<void> {
  const homeCountry = context?.headers ? getIpCountry(context.headers) : null;

  if (!homeCountry || !isCountryCode(homeCountry) || session.impersonatedBy) {
    return;
  }

  await safeAsync(() => fillEmptyHomeCountry({ homeCountry, userId: session.userId }));
}

async function fillEmptyHomeCountry({
  homeCountry,
  userId,
}: {
  homeCountry: string;
  userId: string;
}) {
  const filled = await prisma.userLearningProfile.updateMany({
    data: { homeCountry },
    where: { homeCountry: null, userId },
  });

  if (filled.count === 0) {
    await prisma.userLearningProfile.createMany({
      data: [{ homeCountry, userId }],
      skipDuplicates: true,
    });
  }
}

export const reportSignUpAfterAuthCreate: UserCreateAfterHook = async (user) => {
  if (user.isAnonymous === true) {
    return;
  }

  await reportAuthEvent({ name: "sign-up", userId: user.id });
};

function readProvider(context: GenericEndpointContext): string | null {
  if (context.path === "/callback/:id") {
    return getString(context.params, "id");
  }

  return context.path === "/sign-in/social" ? getString(context.body, "provider") : null;
}

function getSignInMethod(context: GenericEndpointContext | null): SignInMethod | null {
  if (!context) {
    return null;
  }

  if (context.path === "/sign-in/email-otp") {
    return "otp";
  }

  const provider = readProvider(context);

  return provider === "apple" || provider === "google" ? provider : null;
}

export async function reportSignInAfterSessionCreate(
  session: { userId: string },
  context: GenericEndpointContext | null,
): Promise<void> {
  const method = getSignInMethod(context);

  if (method) {
    await reportAuthEvent({ method, name: "sign-in", userId: session.userId });
  }
}
