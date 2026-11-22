import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { awardCourseCertificates } from "../../../certificates/_utils/award-course-certificate";
import { awardLanguageLevelCertificates } from "../../../certificates/_utils/award-language-certificates";
import { getBand } from "../level-test-rules";

export async function skipConfirmedLanguageLessons({
  through,
  goalId,
  now,
  topicIds,
  tx,
}: {
  through: CefrLevel | null;
  topicIds?: ReadonlySet<string>;
  goalId: string;
  now: Date;
  tx: TransactionClient;
}): Promise<string[]> {
  if (!through || topicIds?.size === 0) {
    return [];
  }

  const items = await tx.planItem.findMany({
    select: {
      id: true,
      lesson: {
        select: { skills: { select: { skill: { select: { cefrLevel: true, id: true } } } } },
      },
    },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  const ids = items.flatMap(({ id, lesson }) => {
    const topics = lesson?.skills ?? [];

    return topics.length > 0 &&
      topics.every(
        ({ skill }) =>
          skill.cefrLevel !== null &&
          getBand(skill.cefrLevel) <= getBand(through) &&
          (topicIds === undefined || topicIds.has(skill.id)),
      )
      ? [id]
      : [];
  });

  if (ids.length === 0) {
    return [];
  }

  const finished = await tx.planItem.updateManyAndReturn({
    data: { completedAt: now, status: "testedOut" },
    select: { id: true, kind: true, phase: true, planId: true },
    where: { id: { in: ids }, status: "todo" },
  });

  await awardLanguageLevelCertificates(tx, { finished });
  await awardCourseCertificates(tx, { finished });

  return finished.map(({ id }) => id);
}
