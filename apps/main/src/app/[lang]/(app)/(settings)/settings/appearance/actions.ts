"use server";

import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { learningProfileUpdateSchema } from "@zoonk/core/profile/contract";
import { updateLearningProfile } from "@zoonk/core/profile/update";
import { type AppearanceBuddy } from "@zoonk/learn/appearance";

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

export async function setHomeCountryAction(homeCountry: unknown): Promise<boolean> {
  return saveProfile({ homeCountry });
}

export async function applyHomeCountryAction(homeCountry: unknown): Promise<LearnerSummary | null> {
  return (await saveProfile({ homeCountry })) ? getLearnerSummary() : null;
}
