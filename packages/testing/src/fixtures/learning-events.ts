import { type LearningEvent, prisma } from "@zoonk/db";
import { toUTCMidnight } from "@zoonk/utils/date";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

const DEFAULT_LESSON_SECONDS = 180;

/**
 * Times default to the last three minutes; the local date, hour and weekday come from `endedAt` in
 * UTC.
 */
export async function learningEventFixture(
  attrs: FixtureAttrs<LearningEvent, "contentIds"> & Pick<LearningEvent, "userId">,
) {
  const endedAt = attrs.endedAt ?? new Date();
  const seconds = attrs.seconds ?? DEFAULT_LESSON_SECONDS;

  return prisma.learningEvent.create({
    data: {
      hour: endedAt.getUTCHours(),
      kind: "lesson",
      localDate: toUTCMidnight(endedAt),
      startedAt: new Date(endedAt.getTime() - seconds * 1000),
      weekday: endedAt.getUTCDay(),
      ...attrs,
      endedAt,
      seconds,
    },
  });
}
