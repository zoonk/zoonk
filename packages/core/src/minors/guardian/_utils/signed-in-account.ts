import "server-only";
import { prisma } from "@zoonk/db";
import { getAgeGroup } from "@zoonk/utils/age";
import { io } from "next/cache";
import { getSession } from "../../../users/get-session";

/**
 * Loads the session's account with what guardian rules need: whether it's a guest, a verified
 * email (guardians are identified by it) and the learner's age group.
 */
export async function getSignedInAccount() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    include: { learningProfile: { select: { birthMonth: true, birthYear: true } } },
    where: { id: session.user.id },
  });

  if (!user) {
    return null;
  }

  // The age group reads today's date; guardian pages render per request, never prefetched.
  await io();

  return {
    ageGroup: getAgeGroup({
      birthMonth: user.learningProfile?.birthMonth ?? null,
      birthYear: user.learningProfile?.birthYear ?? null,
    }),
    email: user.email.toLowerCase(),
    emailVerified: user.emailVerified,
    id: user.id,
    isAnonymous: user.isAnonymous,
    name: user.name,
  };
}

/** A guardian acts through the verified email the invite was sent to. */
export async function getSignedInGuardianEmail(): Promise<string | null> {
  const account = await getSignedInAccount();

  if (!account || account.isAnonymous || !account.emailVerified) {
    return null;
  }

  return account.email;
}
