"use server";

import { learningProfileUpdateSchema } from "@zoonk/core/profile/contract";
import { updateLearningProfile } from "@zoonk/core/profile/update";
import { type AppearanceBuddy } from "@zoonk/learn/appearance";

/** Saves one change to the profile, after the same validation the public API runs. */
async function saveProfile(input: unknown): Promise<boolean> {
  const parsed = learningProfileUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const result = await updateLearningProfile(parsed.data);
  return result.status === "updated";
}

export async function saveBuddyAction(buddy: AppearanceBuddy): Promise<boolean> {
  return saveProfile({ buddy });
}

export async function setSoundsEnabledAction(soundsEnabled: boolean): Promise<boolean> {
  return saveProfile({ soundsEnabled });
}

export async function setDailyLimitAction(dailyLimitMinutes: number | null): Promise<boolean> {
  return saveProfile({ dailyLimitMinutes });
}
