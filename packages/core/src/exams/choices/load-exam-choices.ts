import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { type ExamChoiceView } from "./exam-choice-contract";
import {
  type ExamChoice,
  findPartAreas,
  listExamChoiceViews,
  readExamChoices,
} from "./exam-choices";

export async function loadExamChoices(goalId: string): Promise<ExamChoice[]> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  return readExamChoices(plan?.settings);
}

async function loadStructure(
  examBlueprintId: string | null,
  knownBlueprint?: Pick<ExamBlueprint, "structure"> | null,
): Promise<ExamStructure | null> {
  if (!examBlueprintId) {
    return null;
  }

  const blueprint =
    knownBlueprint === undefined
      ? await prisma.examBlueprint.findUnique({
          select: { structure: true },
          where: { id: examBlueprintId },
        })
      : knownBlueprint;

  return examStructureSchema.safeParse(blueprint?.structure).data ?? null;
}

export async function loadExamChoiceViews({
  blueprint,
  choices,
  examBlueprintId,
}: {
  blueprint?: Pick<ExamBlueprint, "structure"> | null;
  choices: readonly ExamChoice[];
  examBlueprintId: string | null;
}): Promise<ExamChoiceView[]> {
  const structure = await loadStructure(examBlueprintId, blueprint);
  return structure ? listExamChoiceViews({ choices, structure }) : [];
}

export async function loadPartAreas({
  areas,
  examBlueprintId,
}: {
  areas: readonly string[];
  examBlueprintId: string | null;
}): Promise<Map<string, string>> {
  const structure = await loadStructure(examBlueprintId);
  return structure ? findPartAreas({ areas, structure }) : new Map();
}
