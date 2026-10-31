"use server";

import { learningProfileUpdateSchema } from "@zoonk/core/profile/contract";
import { updateLearningProfile } from "@zoonk/core/profile/update";
import { getSession } from "@zoonk/core/users/session";
import { type AppearanceBuddy } from "@zoonk/learn/appearance";
import {
  USAGE_DATA_COOKIE,
  USAGE_DATA_COOKIE_MAX_AGE,
  formatUsageDataCookie,
} from "@zoonk/utils/usage-data";
import { cookies } from "next/headers";

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

/** The browser keeps it for a visitor; a guest's or learner's account keeps it too. */
export async function setShareUsageDataAction(shareUsageData: unknown): Promise<boolean> {
  if (typeof shareUsageData !== "boolean") {
    return false;
  }

  const [cookieStore, session] = await Promise.all([cookies(), getSession()]);

  cookieStore.set(USAGE_DATA_COOKIE, formatUsageDataCookie(shareUsageData), {
    maxAge: USAGE_DATA_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });

  return session ? saveProfile({ shareUsageData }) : true;
}
