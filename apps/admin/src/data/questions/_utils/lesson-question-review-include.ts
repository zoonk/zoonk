export const lessonQuestionReviewInclude = {
  thread: {
    select: {
      lesson: {
        select: {
          chapter: { select: { course: { select: { title: true } }, title: true } },
          kind: true,
          title: true,
        },
      },
      user: { select: { email: true, id: true, name: true, username: true } },
    },
  },
} as const;
