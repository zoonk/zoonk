"use server";

import { updateLearningProfile } from "@zoonk/core/profile/update";
import { getSession } from "@zoonk/core/users/session";
import {
  USAGE_DATA_COOKIE,
  USAGE_DATA_COOKIE_MAX_AGE,
  formatUsageDataCookie,
} from "@zoonk/utils/usage-data";
import { cookies } from "next/headers";

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

  if (!session) {
    return true;
  }

  const result = await updateLearningProfile({ shareUsageData });
  return result.status === "updated";
}
