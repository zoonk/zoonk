import { z } from "zod";

/** A follow's answer: whether the learner's day moved. */
const timeZoneFollowSchema = z.object({ moved: z.boolean() });

type TimeZoneFollow = z.infer<typeof timeZoneFollowSchema>;

/** Asks Main to follow the device's zone for a goal (`POST /api/goals/[goalId]/time-zone`). */
export async function requestTimeZoneFollow({
  goalId,
  timeZone,
}: {
  goalId: string;
  timeZone: string;
}): Promise<TimeZoneFollow> {
  const response = await fetch(`/api/goals/${goalId}/time-zone`, {
    body: JSON.stringify({ timeZone }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Following the time zone failed with ${response.status}`);
  }

  return timeZoneFollowSchema.parse(await response.json());
}
