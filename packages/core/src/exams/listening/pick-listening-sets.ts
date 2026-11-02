import "server-only";
import { prisma } from "@zoonk/db";
import { type ListeningPart } from "./listening-parts";

export const MAX_SETS_PER_PART = 10;

export function getPartSetsFilter({
  examBlueprintId,
  scriptLanguage,
  task,
}: {
  examBlueprintId: string;
  scriptLanguage: string;
  task: string;
}) {
  return {
    AND: [
      { content: { equals: task, path: ["task"] } },
      { content: { equals: scriptLanguage, path: ["scriptLanguage"] } },
    ],
    examBlueprintId,
    kind: "audio" as const,
  };
}

export type ListeningPartPick = { part: ListeningPart; setId: string | null; needsSet: boolean };

type StoredSet = {
  id: string;
  items: { attempts: { answeredAt: Date }[] }[];
  mediaAssetId: string | null;
};

function getLastAnswered(set: StoredSet): number | null {
  const times = set.items.flatMap((item) => item.attempts.map((attempt) => attempt.answeredAt));
  return times.length > 0 ? Math.max(...times.map((time) => time.getTime())) : null;
}

function pickSet(sets: readonly StoredSet[]): Omit<ListeningPartPick, "part"> {
  const voiced = sets.filter((set) => set.mediaAssetId !== null);
  const answered = voiced.map((set) => ({ last: getLastAnswered(set), set }));
  const unheard = answered.filter(({ last }) => last === null).map(({ set }) => set);

  const [heardLongestAgo] = answered
    .flatMap(({ last, set }) => (last === null ? [] : [{ last, set }]))
    .toSorted((first, second) => first.last - second.last);

  const canPrepare = voiced.length < sets.length || sets.length < MAX_SETS_PER_PART;

  return {
    needsSet: unheard.length === 0 && canPrepare,
    setId: unheard[0]?.id ?? heardLongestAgo?.set.id ?? null,
  };
}

/** Internal: the caller must derive `userId` from the authenticated session. */
export async function pickListeningSets({
  examBlueprintId,
  parts,
  scriptLanguage,
  userId,
}: {
  examBlueprintId: string;
  parts: readonly ListeningPart[];
  scriptLanguage: string;
  userId: string;
}): Promise<ListeningPartPick[]> {
  return Promise.all(
    parts.map(async (part) => {
      const sets = await prisma.itemSet.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          items: {
            select: {
              attempts: {
                orderBy: { answeredAt: "desc" },
                select: { answeredAt: true },
                take: 1,
                where: { userId },
              },
            },
          },
          mediaAssetId: true,
        },
        where: getPartSetsFilter({ examBlueprintId, scriptLanguage, task: part.task }),
      });

      return { part, ...pickSet(sets) };
    }),
  );
}
