export const ErrorCode = {
  chapterAlreadyRemoved: "chapterAlreadyRemoved",
  chapterNotFound: "chapterNotFound",
  chapterNotInCourse: "chapterNotInCourse",
  courseNotFound: "courseNotFound",
  forbidden: "forbidden",
  organizationNotFound: "organizationNotFound",
  orgMismatch: "orgMismatch",
  unauthorized: "unauthorized",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
