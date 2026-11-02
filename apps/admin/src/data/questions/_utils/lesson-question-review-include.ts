export const lessonQuestionReviewInclude = {
  thread: {
    select: {
      libraryLesson: {
        select: {
          homeChapter: {
            select: { homeCourse: { select: { id: true, title: true } }, title: true },
          },
          id: true,
          title: true,
        },
      },
      user: { select: { email: true, id: true, name: true, username: true } },
    },
  },
} as const;
