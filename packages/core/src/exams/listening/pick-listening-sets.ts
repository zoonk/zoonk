import "server-only";
import { prisma } from "@zoonk/db";
import { type ListeningPart } from "./listening-parts";

/**
 * The most sets one part of an exam gets. Past it, a learner who heard them all hears the one they
 * heard longest ago again, so a part's recordings are written and voiced at most this many times,
 * for every learner of the exam together (about $0.07 each: the script $0.03 and its voicing
 * $0.04 for four minutes).
 */
export const MAX_SETS_PER_PART = 10;

/** A part's stored sets: same exam, same part in the notice's words, same recording language. */
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

export type ListeningPartPick = {
  part: ListeningPart;
  /**
   * The voiced set the learner hears: one they haven't answered, the oldest first, or else the one
   * they answered longest ago; null while the part has no voiced set.
   */
  setId: string | null;
  /**
   * Whether the part needs a set made ready (`prepareListeningPart`): the learner answered every
   * voiced one, and there's an unvoiced one to voice or the part isn't at its cap.
   */
  needsSet: boolean;
};

type StoredSet = {
  id: string;
  items: { attempts: { answeredAt: Date }[] }[];
  mediaAssetId: string | null;
};

/** When the learner last answered one of the set's questions; null when they never did. */
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

/**
 * The set each listening part plays for the learner, from the exam's shared sets, and which parts
 * need one made ready (see `ListeningPartPick`). Internal: the caller derives `userId` from the
 * session.
 */
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
        orderBy: { createdAt: "asc" },
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
