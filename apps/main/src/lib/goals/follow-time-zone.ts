import { z } from "zod";

/** A follow's answer: whether the learner's day moved, with the learner's revision when it did. */
const timeZoneFollowSchema = z.union([
  z.object({ learnerRevision: z.string(), moved: z.literal(true) }),
  z.object({ moved: z.literal(false) }),
]);

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
