import "server-only";
import { prisma } from "@zoonk/db";
import { listeningContentSchema } from "../../library/listening/listening-content";
import { readMockPlays } from "./_utils/mock-plays";
import { findOwnedMock, getSectionDeadline } from "./_utils/owned-mock";

export type RecordMockPlayResult =
  | { played: number; status: "counted" | "usedUp" }
  | { status: "invalidSet" | "notFound" | "notRunning" | "unauthorized" };

/** How many times the exam plays one of the running section's recordings; null for another set. */
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

/**
 * Counts a play of a recording in the mock's running listening section, as it starts: the exam
 * plays each one a set number of times (once or twice) and gives none back, so the count lives on
 * the mock. A reload, another tab or another device opens the recording with the plays it has
 * left, and a play started on a page that didn't know of the last one is `usedUp`: the page stops
 * it. Counted one at a time, so two pages starting it at once can't both get the last play.
 */
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

  // On the break between sections the next one hasn't started; after its time, it's over.
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

  const counted = await prisma.$queryRaw<{ played: number }[]>`
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
