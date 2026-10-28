import "server-only";
import { prisma } from "@zoonk/db";
import { loadListeningExam } from "../../listening/listening-exam";
import { pickListeningSets } from "../../listening/pick-listening-sets";
import { type MockFormat, getItemFormatKey } from "../mock-format-mix";
import { type MockCandidate } from "../mock-plan";

export type MockListening = { recordings: Map<string, MockCandidate[]>; unvoiced: Set<string> };

export async function loadListeningCandidates({
  goalId,
  mix,
  userId,
}: {
  goalId: string;
  mix: readonly MockFormat[];
  userId: string;
}): Promise<MockListening> {
  const exam = await loadListeningExam(goalId);

  if (!exam) {
    return { recordings: new Map(), unvoiced: new Set() };
  }

  const picks = await pickListeningSets({
    examBlueprintId: exam.blueprintId,
    parts: exam.parts,
    scriptLanguage: exam.scriptLanguage,
    userId,
  });

  const bySection = Map.groupBy(picks, (pick) => pick.part.sectionName);

  const ready = [...bySection].filter(([, sectionPicks]) =>
    sectionPicks.every((pick) => pick.setId !== null),
  );

  const unvoiced = new Set(
    [...bySection.keys()].filter((name) => !ready.some(([readyName]) => readyName === name)),
  );

  const setIds = ready.flatMap(([, sectionPicks]) =>
    sectionPicks.flatMap((pick) => pick.setId ?? []),
  );

  const [items, answers] = await Promise.all([
    prisma.item.findMany({
      orderBy: { setPosition: "asc" },
      select: {
        content: true,
        difficulty: true,
        format: true,
        id: true,
        setId: true,
        setPosition: true,
        skillId: true,
      },
      where: { setId: { in: setIds } },
    }),
    prisma.attempt.findMany({
      distinct: ["itemId"],
      select: { itemId: true },
      where: { item: { setId: { in: setIds } }, userId },
    }),
  ]);

  const answered = new Set(answers.map((answer) => answer.itemId));
  const bySet = Map.groupBy(items, (item) => item.setId ?? "");

  const recordings = new Map(
    ready.map(([sectionName, sectionPicks]) => [
      sectionName,
      sectionPicks.flatMap((pick) => {
        const members = bySet.get(pick.setId ?? "") ?? [];
        const heard = members.some((member) => answered.has(member.id));

        return members.map((member, position) => ({
          answered: heard,
          area: sectionName,
          difficulty: member.difficulty,
          format: getItemFormatKey({ item: member, mix }),
          itemId: member.id,
          set: { id: pick.setId ?? "", position, size: members.length },
          skillId: member.skillId,
        }));
      }),
    ]),
  );

  return { recordings, unvoiced };
}
