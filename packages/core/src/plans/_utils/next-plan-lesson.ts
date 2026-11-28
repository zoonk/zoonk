export function nextPlanLessonQuery(goalId: string) {
  return {
    orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
    where: { kind: "lesson", plan: { goalId }, status: "todo" } as const,
  };
}
