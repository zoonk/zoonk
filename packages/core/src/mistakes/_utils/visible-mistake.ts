import "server-only";

export const visibleMistakeWhere = {
  OR: [
    { attemptId: null },
    { attempt: { mockExamId: null } },
    { attempt: { mockExam: { status: "finished" as const } } },
  ],
};

export const openVisibleMistakeWhere = { ...visibleMistakeWhere, status: "open" as const };
