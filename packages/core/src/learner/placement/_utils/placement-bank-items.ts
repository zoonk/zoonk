import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import {
  type ExamChoiceFormat,
  fitsExamChoice,
  getExamChoiceFormat,
} from "../../../library/exams/exam-choice-format";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { PLACEMENT_ITEM_FORMATS, preferExamItems } from "./placement-items";

async function loadExamChoice(
  examBlueprintId: string | null,
  tx: TransactionClient = prisma,
): Promise<ExamChoiceFormat | null> {
  const blueprint = examBlueprintId
    ? await tx.examBlueprint.findUnique({ where: { id: examBlueprintId } })
    : null;

  return blueprint ? getExamChoiceFormat(readBlueprintContent(blueprint).structure) : null;
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
  const [items, choice] = await Promise.all([
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
    loadExamChoice(examBlueprintId, tx),
  ]);

  const fitting = items
    .filter((item) => fitsExamChoice({ choice, item }))
    .map(({ content: _content, ...item }) => item);

  return preferExamItems({ examBlueprintId, items: fitting, writingSkillIds });
}
