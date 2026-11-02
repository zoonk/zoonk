import "server-only";
import { prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { listeningContentSchema } from "../../library/listening/listening-content";
import { readMockPlays } from "./_utils/mock-plays";
import { findOwnedMock, getSectionDeadline } from "./_utils/owned-mock";

export type RecordMockPlayResult =
  | { played: number; status: "counted" | "usedUp" }
  | { status: "invalidSet" | "notFound" | "notRunning" | "unauthorized" };

async function findPlayLimit({
  itemIds,
  setId,
}: {
  itemIds: string[];
  setId: string;
}): Promise<number | null> {
  const set = await prisma.itemSet.findFirst({
    select: { content: true },
    where: { id: setId, items: { some: { id: { in: itemIds } } }, kind: "audio" },
  });

  const content = set ? listeningContentSchema.safeParse(set.content) : null;
  return content?.success ? content.data.plays : null;
}

export async function recordMockPlay({
  blockId,
  setId,
}: {
  blockId: string;
  setId: string;
}): Promise<RecordMockPlayResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { mock } = found.owned;
  const now = Date.now();

  if (
    mock?.status !== "active" ||
    mock.sectionStartedAt.getTime() > now ||
    now > getSectionDeadline(mock).getTime()
  ) {
    return { status: "notRunning" };
  }

  const section = mock.conditions.sections[mock.sectionIndex];

  const limit =
    section?.kind === "listening" ? await findPlayLimit({ itemIds: section.itemIds, setId }) : null;

  if (limit === null) {
    return { status: "invalidSet" };
  }

  const counted = await writeLearnerChange({ userId: found.owned.userId }, async (tx) => {
    const rows = await tx.$queryRaw<{ played: number }[]>`
    UPDATE mock_exams
    SET listening_plays = jsonb_set(
          listening_plays,
          ARRAY[${setId}::text],
          to_jsonb(COALESCE((listening_plays ->> ${setId}::text)::int, 0) + 1)
        ),
        updated_at = now()
    WHERE id = ${mock.id}::uuid
      AND status = 'active'
      AND section_index = ${mock.sectionIndex}
      AND COALESCE((listening_plays ->> ${setId}::text)::int, 0) < ${limit}
    RETURNING (listening_plays ->> ${setId}::text)::int AS played
  `;

    return rows.length > 0 ? rows : unchanged(rows);
  });

  const played = counted[0]?.played;

  if (played !== undefined) {
    return { played, status: "counted" };
  }

  const stored = await prisma.mockExam.findUnique({
    select: { listeningPlays: true, sectionIndex: true, status: true },
    where: { id: mock.id },
  });

  if (stored?.status !== "active" || stored.sectionIndex !== mock.sectionIndex) {
    return { status: "notRunning" };
  }

  return { played: readMockPlays({ plays: stored.listeningPlays, setId }), status: "usedUp" };
}
