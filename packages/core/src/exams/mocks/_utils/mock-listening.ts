import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { loadListeningExam } from "../../listening/listening-exam";
import { type ListeningPart } from "../../listening/listening-parts";
import { pickListeningSets } from "../../listening/pick-listening-sets";
import { type MockFormat, getItemFormatKey } from "../mock-format-mix";
import { type MockCandidate } from "../mock-plan";

export type MockListening = {
  missingParts: ListeningPart[];
  recordings: Map<string, MockCandidate[]>;
  unvoiced: Set<string>;
};

export async function loadListeningCandidates({
  client = prisma,
  exclude,
  goalId,
  mix,
  userId,
}: {
  client?: TransactionClient;
  exclude?: readonly string[];
  goalId: string;
  mix: readonly MockFormat[];
  userId: string;
}): Promise<MockListening> {
  const exam = await loadListeningExam(goalId, client);

  if (!exam) {
    return { missingParts: [], recordings: new Map(), unvoiced: new Set() };
  }

  const picks = await pickListeningSets({
    client,
    examBlueprintId: exam.blueprintId,
    exclude,
    mockOnly: true,
    parts: exam.parts,
    scriptLanguage: exam.scriptLanguage,
    userId,
  });

  const bySection = Map.groupBy(picks, (pick) => pick.part.sectionName);

  const unvoiced = new Set(
    picks.filter((pick) => pick.needsSet).map((pick) => pick.part.sectionName),
  );

  const setIds = picks.flatMap((pick) => pick.setId ?? []);

  const items = await client.item.findMany({
    orderBy: { setPosition: "asc" },
    select: { content: true, difficulty: true, format: true, id: true, setId: true, skillId: true },
    where: { setId: { in: setIds } },
  });

  const bySet = Map.groupBy(items, (item) => item.setId ?? "");

  const recordings = new Map(
    [...bySection].map(([sectionName, sectionPicks]) => [
      sectionName,
      sectionPicks.flatMap((pick) => {
        const members = bySet.get(pick.setId ?? "") ?? [];

        return members.map((member, position) => ({
          answered: false,
          area: sectionName,
          difficulty: member.difficulty,
          format: getItemFormatKey({ item: member, mix }),
          itemFormat: member.format,
          itemId: member.id,
          set: { id: pick.setId ?? "", position, size: members.length },
          skillId: member.skillId,
        }));
      }),
    ]),
  );

  return {
    missingParts: picks.filter((pick) => pick.needsSet).map((pick) => pick.part),
    recordings,
    unvoiced,
  };
}
