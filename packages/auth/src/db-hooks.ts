import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { type GenericEndpointContext } from "better-auth";
import { type SignInMethod, reportAuthEvent } from "./auth-events";
import { type UserCreateAfterHook } from "./user-create-hooks";

export const ensureUserProgressAfterAuthCreate: UserCreateAfterHook = async (user) => {
  await prisma.userProgress.upsert({
    create: { lastActiveAt: user.createdAt ?? new Date(), userId: user.id },
    update: {},
    where: { userId: user.id },
  });
};

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
