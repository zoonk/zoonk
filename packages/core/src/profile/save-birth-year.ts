import "server-only";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { closeUnderageAccount } from "../users/_utils/close-underage-account";
import { getSession } from "../users/get-session";
import { findLearningProfileView } from "./_utils/learning-profile-view";
import { type BirthYearCheck, checkBirthYear } from "./check-birth-year";
import { type BirthYearInput, type LearningProfileView } from "./learning-profile-contract";

export type SaveBirthYearResult =
  | Exclude<BirthYearCheck, { status: "allowed" }>
  | { minimumAge: number; status: "accountClosed" }
  | { profile: LearningProfileView; status: "saved" }
  | { status: "unauthorized" };

/**
 * Asked once: the first saved year stays. Below the minimum age for the request's country nothing
 * is saved, and the caller ends the session so the learner can't go on. Certainly below it, the
 * account is closed and deleted, and its website Plus refunded in full (Terms § 2).
 */
async function closeIfCertainlyUnderage({
  check,
  user,
}: {
  check: Extract<BirthYearCheck, { status: "belowMinimumAge" }>;
  user: { email: string; id: string; name: string };
}): Promise<SaveBirthYearResult> {
  if (!check.certain) {
    return check;
  }

  await closeUnderageAccount(user);
  return { minimumAge: check.minimumAge, status: "accountClosed" };
}

export async function saveBirthYear({ birthYear }: BirthYearInput): Promise<SaveBirthYearResult> {
  const [session, check] = await Promise.all([getSession(), checkBirthYear({ birthYear })]);

  if (!session) {
    return { status: "unauthorized" };
  }

  if (check.status === "invalidBirthYear") {
    return check;
  }

  const userId = session.user.id;

  const outcome = await writeLearnerChange({ userId }, async (tx) => {
    const saved = await tx.userLearningProfile.findUnique({
      select: { birthYear: true },
      where: { userId },
    });

    if (saved?.birthYear) {
      return unchanged("kept" as const);
    }

    if (check.status === "belowMinimumAge") {
      return unchanged("belowMinimumAge" as const);
    }

    await tx.userLearningProfile.upsert({
      create: { birthYear, userId },
      update: { birthYear },
      where: { userId },
    });

    return "saved" as const;
  });

  if (outcome === "belowMinimumAge" && check.status === "belowMinimumAge") {
    return closeIfCertainlyUnderage({ check, user: session.user });
  }

  if (outcome === "saved") {
    revalidateCacheTags([getLearningProfileCacheTag(userId)]);
  }

  return { profile: await findLearningProfileView(userId), status: "saved" };
}
