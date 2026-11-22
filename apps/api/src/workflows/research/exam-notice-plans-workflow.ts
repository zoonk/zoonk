import { updateExamNoticePlans } from "./read-exam-blueprint";

export function getExamNoticePlansToken(examBlueprintId: string): string {
  return `exam-notice-plans:${examBlueprintId}`;
}

/** Brings one exam's shared graph and every active plan for it in line with its notice. */
export async function examNoticePlansWorkflow({
  examBlueprintId,
}: {
  examBlueprintId: string;
}): Promise<void> {
  "use workflow";

  await updateExamNoticePlans({
    examBlueprintId,
    exceptGoalId: null,
    movesExamDays: false,
    noticeId: null,
  });
}
