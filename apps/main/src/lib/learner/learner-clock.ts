import { getRequestInstant } from "@zoonk/core/learner/request-instant";
import { type LearnerClockSnapshot } from "@zoonk/learn/learner-clock";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { IP_TIME_ZONE_HEADER, TIME_ZONE_COOKIE, pickLearnerTimeZone } from "./learner-time-zone";

/**
 * One snapshot per request, so every date the server draws counts from the same zone and moment.
 * Not behind `navigation()`, as the learner summary is: a Server Action's re-render never resolved
 * it, and its response hung with the snapshot still pending.
 */
export const getLearnerClock = cache(async (): Promise<LearnerClockSnapshot> => {
  const [cookieStore, headerList, now] = await Promise.all([
    cookies(),
    headers(),
    getRequestInstant(),
  ]);

  const timeZone = pickLearnerTimeZone({
    cookie: cookieStore.get(TIME_ZONE_COOKIE)?.value,
    header: headerList.get(IP_TIME_ZONE_HEADER),
  });

  return { now: now.getTime(), timeZone };
});
