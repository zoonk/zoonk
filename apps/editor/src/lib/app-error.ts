export const ErrorCode = {
  categoryAlreadyAdded: "categoryAlreadyAdded",
  categoryNotInCourse: "categoryNotInCourse",
  chapterNotFound: "chapterNotFound",
  courseNotFound: "courseNotFound",
  fileTooLarge: "fileTooLarge",
  forbidden: "forbidden",
  invalidAlternativeTitleFormat: "invalidAlternativeTitleFormat",
  invalidCategory: "invalidCategory",
  invalidChapterFormat: "invalidChapterFormat",
  invalidFileType: "invalidFileType",
  invalidJsonFormat: "invalidJsonFormat",
  invalidLessonFormat: "invalidLessonFormat",
  lessonNotFound: "lessonNotFound",
  organizationNotFound: "organizationNotFound",
  orgMismatch: "orgMismatch",
  unauthorized: "unauthorized",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
