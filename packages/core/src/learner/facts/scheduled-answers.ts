import "server-only";
import { AnyNull, type StudySessionBlock, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { readBlockPayload } from "../../sessions/block-payload";

function scheduledAnswer({
  block,
  date,
  includeUnadmitted = false,
}: {
  block: Pick<StudySessionBlock, "estimatedMinutes" | "payload" | "status">;
  date: string;
  includeUnadmitted?: boolean;
}) {
  const { extra, writing, writingPlacement } = readBlockPayload(block);

  return !extra && writing?.unit === "answer" && (includeUnadmitted || writing.admissionId)
    ? [
        {
          completed: block.status === "completed",
          date,
          minutes: block.estimatedMinutes ?? 0,
          placement: Boolean(writingPlacement),
          taskKey: writing.taskKey,
        },
      ]
    : [];
}

export async function loadScheduledAnswers(userId: string, goalId: string, excludingDate?: Date) {
  const blocks = await prisma.studySessionBlock.findMany({
    select: {
      estimatedMinutes: true,
      payload: true,
      session: { select: { localDate: true } },
      status: true,
    },
    where: {
      AND: [
        { payload: { equals: false, path: ["extra"] } },
        { payload: { equals: "answer", path: ["writing", "unit"] } },
        { payload: { not: AnyNull, path: ["writing", "admissionId"] } },
      ],
      kind: "produce",
      session: { goalId, userId, ...(excludingDate && { localDate: { not: excludingDate } }) },
      status: { in: ["active", "completed"] },
    },
  });

  return blocks.flatMap((block) =>
    scheduledAnswer({ block, date: toIsoDate(block.session.localDate) }),
  );
}

export async function loadScheduledAnswersForRefresh({
  goalId,
  kept,
  localDate,
  userId,
}: {
  goalId: string;
  kept: readonly StudySessionBlock[];
  localDate: Date;
  userId: string;
}) {
  const history = await loadScheduledAnswers(userId, goalId, localDate);
  const date = toIsoDate(localDate);

  // Use the queue snapshot for this day, including kept answers whose admission has not landed.
  return [
    ...history,
    ...kept.flatMap((block) =>
      block.kind === "produce" ? scheduledAnswer({ block, date, includeUnadmitted: true }) : [],
    ),
  ];
}

export async function readScheduledAnswers(userId: string, goalId: string) {
  "use cache: private";

  cacheTag(getLearnerModelCacheTag(userId), getUserProgressCacheTag(userId));

  return loadScheduledAnswers(userId, goalId);
}
