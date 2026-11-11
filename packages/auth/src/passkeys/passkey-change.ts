import { prisma } from "@zoonk/db";
import { createPasskeyApprovalOptions, verifyPasskeyApproval } from "./passkey-approval";
import { type PasskeyApprovalOptions, type PasskeyAssertion } from "./passkey-approval-contract";
import { type PasskeyChange } from "./passkey-change-contract";
import { PASSKEY_REGISTRATION_ORIGIN } from "./relying-party";

/** Long enough to confirm with one passkey and then create the next one. */
const CONFIRMATION_MS = 300_000;

/**
 * What a confirmation allows, once: starting a registration, finishing the registration it
 * started, or deleting one passkey.
 */
type ConfirmedStep = "add" | "register" | `delete:${string}`;

function toStep(change: PasskeyChange): ConfirmedStep {
  return change.action === "add" ? "add" : `delete:${change.passkeyId}`;
}

function challengeKey(userId: string, step: ConfirmedStep): string {
  return `passkey-change-challenge:${userId}:${step}`;
}

function confirmationKey(userId: string, step: ConfirmedStep): string {
  return `passkey-change:${userId}:${step}`;
}

function store({ identifier, value }: { identifier: string; value: string }) {
  return prisma.$transaction([
    prisma.verification.deleteMany({ where: { identifier } }),
    prisma.verification.create({
      data: { expiresAt: new Date(Date.now() + CONFIRMATION_MS), identifier, value },
    }),
  ]);
}

/** Takes the stored value so nothing else can use it; null when there's none or it expired. */
async function take(identifier: string): Promise<string | null> {
  const stored = await prisma.verification.findFirst({
    select: { id: true, value: true },
    where: { expiresAt: { gt: new Date() }, identifier },
  });

  if (!stored) {
    return null;
  }

  const { count } = await prisma.verification.deleteMany({ where: { id: stored.id } });
  return count === 1 ? stored.value : null;
}

/**
 * Starts confirming a change to `userId`'s passkeys: one of their existing passkeys signs a
 * single-use challenge with user verification. Null when they have none, since an account's first
 * passkey needs only its session.
 */
export async function createPasskeyChangeOptions({
  change,
  userId,
}: {
  change: PasskeyChange;
  userId: string;
}): Promise<PasskeyApprovalOptions | null> {
  const options = await createPasskeyApprovalOptions(userId);

  if (options) {
    await store({ identifier: challengeKey(userId, toStep(change)), value: options.challenge });
  }

  return options;
}

/**
 * True once `assertion` is `userId`'s own passkey signing this change's challenge on this app's
 * page. The change may then go ahead once, within a few minutes.
 */
export async function confirmPasskeyChange({
  assertion,
  change,
  userId,
}: {
  assertion: PasskeyAssertion;
  change: PasskeyChange;
  userId: string;
}): Promise<boolean> {
  const step = toStep(change);
  const expectedChallenge = await take(challengeKey(userId, step));

  if (!expectedChallenge) {
    return false;
  }

  const verified = await verifyPasskeyApproval({
    assertion,
    expectedChallenge,
    origin: PASSKEY_REGISTRATION_ORIGIN,
    userId,
  });

  if (verified) {
    await store({ identifier: confirmationKey(userId, step), value: step });
  }

  return verified;
}

/**
 * Whether `userId` may take `step` now. An account without a passkey always may. With one, a
 * session isn't enough, since whatever drives the signed-in browser could add its own passkey and
 * approve with it: the step spends a confirmation, and starting a registration leaves one for
 * finishing it, so a registration started before the first passkey existed can't finish after.
 */
export async function spendPasskeyConfirmation({
  step,
  userId,
}: {
  step: ConfirmedStep;
  userId: string;
}): Promise<boolean> {
  const passkeys = await prisma.passkey.count({ where: { userId } });

  if (passkeys === 0) {
    return true;
  }

  const confirmed = await take(confirmationKey(userId, step));

  if (confirmed && step === "add") {
    await store({ identifier: confirmationKey(userId, "register"), value: "register" });
  }

  return confirmed !== null;
}
