import { isAppError } from "@zoonk/utils/error";
import { getExtracted } from "next-intl/server";
import { ErrorCode } from "./app-error";

export async function getErrorMessage(error: Error): Promise<string> {
  const t = await getExtracted();

  if (isAppError(error)) {
    switch (error.code) {
      case ErrorCode.forbidden:
        return t("You don't have permission to perform this action");
      case ErrorCode.unauthorized:
        return t("Please sign in to continue");
      case ErrorCode.courseNotFound:
        return t("Course not found");
      case ErrorCode.chapterNotFound:
        return t("Chapter not found");
      case ErrorCode.organizationNotFound:
        return t("Organization not found");
      case ErrorCode.chapterNotInCourse:
        return t("Chapter not found in this course");
      case ErrorCode.chapterAlreadyRemoved:
        return t("This chapter has already been removed");
      case ErrorCode.orgMismatch:
        return t("Chapter and course must belong to the same organization");
      case ErrorCode.fileTooLarge:
        return t("File is too large. Maximum size is 5MB");
      case ErrorCode.invalidFileType:
        return t("Invalid file type. Please upload a JSON file");
      case ErrorCode.invalidJsonFormat:
        return t("Invalid JSON format. Please check your file");
      case ErrorCode.invalidChapterFormat:
        return t(
          "Invalid chapter format. Each chapter must have a title and description",
        );
    }
  }

  return t("An unexpected error occurred");
}
