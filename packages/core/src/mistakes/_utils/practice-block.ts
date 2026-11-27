import "server-only";
import { type Mistake, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { readBlockPayload } from "../../sessions/block-payload";
import { loadMistakeReplays } from "../mistake-replay";
import { readPracticeMistakeId } from "./practice-claim";
import { openVisibleMistakeWhere } from "./visible-mistake";

export async function findPracticeBlock({ blockId, userId }: { blockId: string; userId: string }) {
  if (!isUuid(blockId)) {
    return null;
  }

  const block = await prisma.studySessionBlock.findFirst({
    include: { session: { include: { goal: true } } },
    where: { id: blockId, session: { userId } },
  });

  if (!block) {
    return null;
  }

  const { mistakeIds } = readBlockPayload(block);
  return mistakeIds.length > 0 ? { block, mistakeIds, session: block.session } : null;
}

export async function loadPendingBlockMistakes({
  mistakeIds,
  now,
  timeZone,
  userId,
}: {
  mistakeIds: string[];
  now: Date;
  timeZone: string;
  userId: string;
}): Promise<{ mistakes: Mistake[]; replays: Awaited<ReturnType<typeof loadMistakeReplays>> }> {
  if (mistakeIds.length === 0) {
    return { mistakes: [], replays: new Map() };
  }

  const localDate = getDateInTimeZone({ date: now, timeZone });

  const [open, attempts] = await Promise.all([
    prisma.mistake.findMany({
      where: { ...openVisibleMistakeWhere, id: { in: mistakeIds }, userId },
    }),
    prisma.attempt.findMany({
      select: { answer: true },
      where: {
        OR: mistakeIds.map((id) => ({ answer: { equals: id, path: ["practiceMistakeId"] } })),
        answeredAt: { gte: getStartOfLocalDay({ localDate, timeZone }) },
        studySessionId: null,
        userId,
      },
    }),
  ]);

  const answered = new Set(attempts.map((attempt) => readPracticeMistakeId(attempt.answer)));
  const byId = new Map(open.map((mistake) => [mistake.id, mistake]));

  const ordered = mistakeIds
    .map((id) => (answered.has(id) ? undefined : byId.get(id)))
    .filter((mistake): mistake is Mistake => mistake !== undefined);

  return { mistakes: ordered, replays: await loadMistakeReplays({ mistakes: ordered, userId }) };
}
