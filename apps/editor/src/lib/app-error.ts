export const ErrorCode = {
  chapterAlreadyRemoved: "chapterAlreadyRemoved",
  chapterNotFound: "chapterNotFound",
  chapterNotInCourse: "chapterNotInCourse",
  courseNotFound: "courseNotFound",
  fileTooLarge: "fileTooLarge",
  forbidden: "forbidden",
  invalidAlternativeTitleFormat: "invalidAlternativeTitleFormat",
  invalidChapterFormat: "invalidChapterFormat",
  invalidFileType: "invalidFileType",
  invalidJsonFormat: "invalidJsonFormat",
  organizationNotFound: "organizationNotFound",
  orgMismatch: "orgMismatch",
  unauthorized: "unauthorized",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
