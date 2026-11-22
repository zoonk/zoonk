import "server-only";

export const visibleMistakeWhere = {
  OR: [
    { attemptId: null },
    { attempt: { mockExamId: null } },
    { attempt: { mockExam: { status: "finished" as const } } },
  ],
};
