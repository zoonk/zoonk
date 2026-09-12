"use server";

import { updateCurrentUserLearningProfile } from "@zoonk/core/users/learning-profile";
import { safeAsync } from "@zoonk/utils/error";

export async function saveInterests(input: string) {
  const interests = input
    .split(/\r?\n/u)
    .map((interest) => interest.trim())
    .filter(Boolean);

  const { data, error } = await safeAsync(() => updateCurrentUserLearningProfile({ interests }));
  return error ? { status: "unavailable" as const } : data;
}
