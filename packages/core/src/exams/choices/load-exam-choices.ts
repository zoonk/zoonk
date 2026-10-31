import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { type ExamChoiceView } from "./exam-choice-contract";
import { listExamChoiceViews } from "./exam-choice-views";
import { type ExamChoice, findPartAreas, readExamChoices } from "./exam-choices";
import { findNamedChoices } from "./named-exam-choices";

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

/** Onboarding asks a choice only when nothing the learner stated as theirs names one of its options. */
export async function hasUnpickedChoice(
  goal: Pick<Goal, "details" | "examBlueprintId" | "id">,
): Promise<boolean> {
  const [structure, saved] = await Promise.all([
    loadStructure(goal.examBlueprintId),
    loadExamChoices(goal.id),
  ]);

  if (!structure) {
    return false;
  }

  const choices = [...saved, ...findNamedChoices({ choices: saved, goal, structure })];
  return listExamChoiceViews({ choices, structure }).some((choice) => choice.subject === null);
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
