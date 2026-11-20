import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { listMockItemClaims } from "../mocks/_utils/mock-item-uses";
import { type ListeningPart } from "./listening-parts";

export const MAX_SETS_PER_PART = 10;

export function getPartSetsFilter({
  mockOnly = false,
  examBlueprintId,
  scriptLanguage,
  task,
}: {
  mockOnly?: boolean;
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
    items: { some: { retiredAt: null } },
    kind: "audio" as const,
    ...(mockOnly ? { mockOnly: true } : { OR: [{ mockOnly: false }, { mockOnly: null }] }),
  };
}

export type ListeningPartPick = {
  part: ListeningPart;
  setId: string | null;
  needsSet: boolean;
  lastMockUse?: number;
};

type StoredSet = {
  id: string;
  items: { attempts: { answeredAt: Date }[]; mockUses: { spentAt: Date | null }[] }[];
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

function getLastMockUse(set: StoredSet): number | undefined {
  const spent = set.items.flatMap((item) =>
    item.mockUses.flatMap((use) => (use.spentAt ? [use.spentAt.getTime()] : [])),
  );

  return spent.length > 0 ? Math.max(...spent) : (getLastAnswered(set) ?? undefined);
}

/** Internal: the caller must derive `userId` from the authenticated session. */
export async function pickListeningSets({
  client = prisma,
  mockOnly = false,
  exclude = [],
  examBlueprintId,
  parts,
  reuse = false,
  scriptLanguage,
  userId,
}: {
  mockOnly?: boolean;
  examBlueprintId: string;
  exclude?: readonly string[];
  client?: TransactionClient;
  parts: readonly ListeningPart[];
  reuse?: boolean;
  scriptLanguage: string;
  userId: string;
}): Promise<ListeningPartPick[]> {
  const claims = mockOnly ? await listMockItemClaims(client, userId) : null;
  const expired = [...(claims?.expired ?? [])];

  const candidates = await Promise.all(
    parts.map((part) =>
      client.itemSet.findMany({
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
              mockUses: { select: { spentAt: true }, where: { userId } },
            },
          },
          mediaAssetId: true,
        },
        where: {
          ...getPartSetsFilter({ examBlueprintId, mockOnly, scriptLanguage, task: part.task }),
          ...(mockOnly && {
            items: {
              none: {
                OR: [
                  {
                    mockUses: {
                      some: {
                        ...(reuse
                          ? {
                              mockExam: { status: "active" as const },
                              mockExamId: { notIn: expired },
                            }
                          : {
                              OR: [{ spentAt: { not: null } }, { mockExamId: { notIn: expired } }],
                            }),
                        userId,
                      },
                    },
                  },
                  ...(reuse ? [] : [{ attempts: { some: { userId } } }]),
                  { id: { in: [...exclude] } },
                  { mockOnly: false },
                  { mockOnly: null },
                  { retiredAt: { not: null } },
                ],
              },
              some: { retiredAt: null },
            },
          }),
        },
      }),
    ),
  );

  const selected = new Set<string>();

  return parts.map((part, index) => {
    const sets = candidates[index] ?? [];

    if (!mockOnly) {
      return { part, ...pickSet(sets) };
    }

    const [recording] = sets
      .filter((set) => set.mediaAssetId && set.items.length === part.count && !selected.has(set.id))
      .map((set) => ({ id: set.id, lastMockUse: getLastMockUse(set) }))
      .toSorted((first, second) => (first.lastMockUse ?? 0) - (second.lastMockUse ?? 0));

    if (!recording) {
      return { needsSet: true, part, setId: null };
    }

    selected.add(recording.id);
    return { lastMockUse: recording.lastMockUse, needsSet: false, part, setId: recording.id };
  });
}
