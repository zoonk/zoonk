import "server-only";
import { prisma } from "@zoonk/db";
import {
  type ExamChoiceFormat,
  fitsExamChoice,
  getExamChoiceFormat,
} from "../../../library/exams/exam-choice-format";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { PLACEMENT_ITEM_FORMATS, preferExamItems } from "./placement-items";

/** How the goal's exam asks the questions picked by choice; null for a goal without one. */
async function loadExamChoice(examBlueprintId: string | null): Promise<ExamChoiceFormat | null> {
  const blueprint = examBlueprintId
    ? await prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } })
    : null;

  return blueprint ? getExamChoiceFormat(readBlueprintContent(blueprint).structure) : null;
}

/**
 * The questions placement may ask on these skills: the goal's exam's first, general ones where a
 * skill has none of its exam's and none are being written (`preferExamItems`), never another
 * exam's (a shared skill's "on the first day of ENEM…" question isn't for a police exam), and only
 * in the exam's own format (`fitsExamChoice`).
 */
export async function loadPlacementItems({
  examBlueprintId,
  skillIds,
  writingSkillIds,
}: {
  examBlueprintId: string | null;
  skillIds: string[];
  /** Skills whose placement questions the goal's run is still writing. */
  writingSkillIds?: ReadonlySet<string>;
}) {
  const [items, choice] = await Promise.all([
    prisma.item.findMany({
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
        format: { in: [...PLACEMENT_ITEM_FORMATS] },
        skillId: { in: skillIds },
        ...getItemAudienceFilter({ examBlueprintId }),
      },
    }),
    loadExamChoice(examBlueprintId),
  ]);

  const fitting = items
    .filter((item) => fitsExamChoice({ choice, item }))
    .map(({ content: _content, ...item }) => item);

  return preferExamItems({ examBlueprintId, items: fitting, writingSkillIds });
}
