import type { AppError } from "@zoonk/utils/error";
import { isAppError } from "@zoonk/utils/error";
import { getExtracted } from "next-intl/server";
import { ErrorCode, type ErrorCodeType } from "./app-error";

function assertNever(x: never): never {
  throw new Error(`Unhandled error code: ${x}`);
}

function isMainAppError(error: Error): error is AppError<ErrorCodeType> {
  return (
    isAppError(error) &&
    Object.values(ErrorCode).includes(error.code as ErrorCodeType)
  );
}

export async function getErrorMessage(error: Error): Promise<string> {
  const t = await getExtracted();

  if (isMainAppError(error)) {
    switch (error.code) {
      case ErrorCode.unauthorized:
        return t("Please sign in to continue");
      default:
        return assertNever(error.code);
    }
  }

  return t("An unexpected error occurred");
}
