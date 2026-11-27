import "server-only";
import { prisma } from "@zoonk/db";
import { loadMistakeReplays } from "../mistake-replay";
import { mockMistakeWhere } from "./mock-practice";
import { openVisibleMistakeWhere } from "./visible-mistake";

export async function loadPracticeEntries({
  includeAllFormats,
  mockId,
  skillIds,
  userId,
}: {
  includeAllFormats?: boolean;
  mockId?: string;
  skillIds: string[] | null;
  userId: string;
}) {
  const mistakes = await prisma.mistake.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: {
      ...openVisibleMistakeWhere,
      ...(mockId && (await mockMistakeWhere({ mockId, userId }))),
      ...(skillIds && { skillId: { in: skillIds } }),
      userId,
    },
  });

  const replays = await loadMistakeReplays({ mistakes, userId });

  return mistakes.flatMap((mistake) => {
    const replay = replays.get(mistake.id);

    const standard =
      replay?.kind === "item" && ["multipleChoice", "trueFalse"].includes(replay.item.format);

    return replay && (mockId || includeAllFormats || standard) ? [{ ...mistake, replay }] : [];
  });
}
