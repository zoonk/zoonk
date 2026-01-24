export const ErrorCode = {
  activityNotFound: "activityNotFound",
  categoryAlreadyAdded: "categoryAlreadyAdded",
  categoryNotInCourse: "categoryNotInCourse",
  chapterNotFound: "chapterNotFound",
  courseNotFound: "courseNotFound",
  fileTooLarge: "fileTooLarge",
  forbidden: "forbidden",
  invalidActivityFormat: "invalidActivityFormat",
  invalidAlternativeTitleFormat: "invalidAlternativeTitleFormat",
  invalidCategory: "invalidCategory",
  invalidChapterFormat: "invalidChapterFormat",
  invalidFileType: "invalidFileType",
  invalidJsonFormat: "invalidJsonFormat",
  invalidLessonFormat: "invalidLessonFormat",
  lessonNotFound: "lessonNotFound",
  orgMismatch: "orgMismatch",
  organizationNotFound: "organizationNotFound",
  unauthorized: "unauthorized",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
