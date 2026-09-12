import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag, revalidateTag } from "next/cache";
import { getUserSessionCacheTag } from "../cache/tags";
import { getSession } from "./get-session";
import { type LearningProfileInput, learningProfileInputSchema } from "./learning-profile-contract";

function readInterests(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function getCurrentUserLearningProfile() {
  "use cache: private";
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  cacheTag(getUserSessionCacheTag(session.user.id));

  const profile = await prisma.userLearningProfile.findUnique({
    where: { userId: session.user.id },
  });

  return { profile: { interests: readInterests(profile?.interests) }, status: "ready" as const };
}

/** Interests are global; existing unrelated profile fields are preserved on every edit. */
export async function updateCurrentUserLearningProfile(input: LearningProfileInput) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const parsed = learningProfileInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "invalid" as const };
  }

  const interests = [...new Set(parsed.data.interests)];

  await prisma.userLearningProfile.upsert({
    create: { interests, userId: session.user.id },
    update: { interests },
    where: { userId: session.user.id },
  });

  revalidateTag(getUserSessionCacheTag(session.user.id), { expire: 0 });
  return { profile: { interests }, status: "ready" as const };
}
