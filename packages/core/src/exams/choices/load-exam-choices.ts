import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { type ExamChoiceView } from "./exam-choice-contract";
import { listExamChoiceViews } from "./exam-choice-views";
import { type ExamPicks, findPartAreas, readExamPicks } from "./exam-choices";
import { findNamedChoices } from "./named-exam-choices";

export async function loadExamPicks(goalId: string): Promise<ExamPicks> {
  const plan = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  return readExamPicks(plan?.settings);
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
  examBlueprintId,
  picks,
}: {
  blueprint?: Pick<ExamBlueprint, "structure"> | null;
  examBlueprintId: string | null;
  picks: ExamPicks;
}): Promise<ExamChoiceView[]> {
  const structure = await loadStructure(examBlueprintId, blueprint);
  return structure ? listExamChoiceViews({ picks, structure }) : [];
}

/** Onboarding asks a choice only when nothing the learner stated as theirs names one of its options. */
export async function hasUnpickedChoice(
  goal: Pick<Goal, "details" | "examBlueprintId" | "id">,
): Promise<boolean> {
  const [structure, saved] = await Promise.all([
    loadStructure(goal.examBlueprintId),
    loadExamPicks(goal.id),
  ]);

  if (!structure) {
    return false;
  }

  const named = findNamedChoices({ goal, picks: saved, structure });
  const picks = { ...saved, examChoices: [...saved.examChoices, ...named] };
  return listExamChoiceViews({ picks, structure }).some((choice) => choice.subjects.length === 0);
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
