import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { readDatabaseFacts } from "../../../_utils/read-database-facts";
import {
  type ExamChoiceFormat,
  fitsExamChoice,
  getExamChoiceFormats,
} from "../../../library/exams/exam-choice-format";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { PLACEMENT_ITEM_FORMATS, preferExamItems } from "./placement-items";

async function loadChoiceFormats(
  examBlueprintId: string | null,
  tx: TransactionClient = prisma,
): Promise<ExamChoiceFormat[]> {
  const blueprint = examBlueprintId
    ? await tx.examBlueprint.findUnique({ where: { id: examBlueprintId } })
    : null;

  return blueprint ? getExamChoiceFormats(readBlueprintContent(blueprint).structure) : [];
}

/** Never uses another exam's questions; general questions fill gaps only when no matching exam questions are being written. */
export async function loadPlacementItems({
  examBlueprintId,
  skillIds,
  typed,
  writingSkillIds,
  tx = prisma,
}: {
  examBlueprintId: string | null;
  skillIds: string[];
  /** The goal confirms a right quick answer in writing (`confirmsInWriting`). */
  typed: boolean;
  /** Skills whose placement questions the goal's run is still writing. */
  writingSkillIds?: ReadonlySet<string>;
  tx?: TransactionClient;
}) {
  const [items, choices] = await readDatabaseFacts(
    tx,
    () =>
      tx.item.findMany({
        orderBy: { id: "asc" },
        select: {
          content: true,
          difficulty: true,
          examBlueprintId: true,
          format: true,
          id: true,
          skillId: true,
        },
        where: {
          format: { in: PLACEMENT_ITEM_FORMATS.filter((format) => typed || format !== "typed") },
          skillId: { in: skillIds },
          ...getItemAudienceFilter({ examBlueprintId }),
        },
      }),
    () => loadChoiceFormats(examBlueprintId, tx),
  );

  const fitting = items
    .filter((item) => fitsExamChoice({ choices, item }))
    .map(({ content: _content, ...item }) => item);

  return preferExamItems({ examBlueprintId, items: fitting, writingSkillIds });
}
