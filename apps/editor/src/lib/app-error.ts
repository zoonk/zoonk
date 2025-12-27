export const ErrorCode = {
  categoryAlreadyAdded: "categoryAlreadyAdded",
  categoryNotInCourse: "categoryNotInCourse",
  chapterAlreadyRemoved: "chapterAlreadyRemoved",
  chapterNotFound: "chapterNotFound",
  chapterNotInCourse: "chapterNotInCourse",
  courseNotFound: "courseNotFound",
  fileTooLarge: "fileTooLarge",
  forbidden: "forbidden",
  invalidAlternativeTitleFormat: "invalidAlternativeTitleFormat",
  invalidCategory: "invalidCategory",
  invalidChapterFormat: "invalidChapterFormat",
  invalidFileType: "invalidFileType",
  invalidJsonFormat: "invalidJsonFormat",
  invalidLessonFormat: "invalidLessonFormat",
  lessonAlreadyRemoved: "lessonAlreadyRemoved",
  lessonNotFound: "lessonNotFound",
  lessonNotInChapter: "lessonNotInChapter",
  organizationNotFound: "organizationNotFound",
  orgMismatch: "orgMismatch",
  unauthorized: "unauthorized",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
