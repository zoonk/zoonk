import type { AppError } from "@zoonk/utils/error";
import { isAppError } from "@zoonk/utils/error";
import { getExtracted } from "next-intl/server";
import { ErrorCode, type ErrorCodeType } from "./app-error";

// ensures that we don't have missing translations for error codes
function assertNever(x: never): never {
  throw new Error(`Unhandled error code: ${String(x)}`);
}

const ERROR_CODE_VALUES = Object.values(ErrorCode);

function isErrorCode(code: unknown): code is ErrorCodeType {
  return typeof code === "string" && ERROR_CODE_VALUES.some((v) => v === code);
}

function isEditorError(error: Error): error is AppError<ErrorCodeType> {
  return isAppError(error) && isErrorCode(error.code);
}

export async function getErrorMessage(error: Error): Promise<string> {
  const t = await getExtracted();

  if (isEditorError(error)) {
    switch (error.code) {
      case ErrorCode.activityNotFound:
        return t("Activity not found");
      case ErrorCode.categoryAlreadyAdded:
        return t("This category has already been added to the course");
      case ErrorCode.categoryNotInCourse:
        return t("Category not found in this course");
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
      case ErrorCode.orgMismatch:
        return t("Chapter and course must belong to the same organization");
      case ErrorCode.fileTooLarge:
        return t("File is too large. Maximum size is 5MB");
      case ErrorCode.invalidFileType:
        return t("Invalid file type. Please upload a JSON file");
      case ErrorCode.invalidJsonFormat:
        return t("Invalid JSON format. Please check your file");
      case ErrorCode.invalidCategory:
        return t("Invalid category");
      case ErrorCode.invalidChapterFormat:
        return t(
          "Invalid chapter format. Each chapter must have a title and description",
        );
      case ErrorCode.invalidActivityFormat:
        return t(
          "Invalid activity format. Each activity must have a kind and position",
        );
      case ErrorCode.invalidAlternativeTitleFormat:
        return t(
          "Invalid format. Please provide an array of non-empty strings",
        );
      case ErrorCode.invalidLessonFormat:
        return t(
          "Invalid lesson format. Each lesson must have a title and description",
        );
      case ErrorCode.lessonNotFound:
        return t("Lesson not found");
      default:
        return assertNever(error.code);
    }
  }

  return t("An unexpected error occurred");
}
