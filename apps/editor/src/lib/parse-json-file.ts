import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode, type ErrorCodeType } from "./app-error";

const BYTES_PER_KB = 1024;
const KB_PER_MB = 1024;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * KB_PER_MB * BYTES_PER_KB;

export async function parseJsonFile<T>(params: {
  file: File;
  invalidFormatError: ErrorCodeType;
  validate: (data: unknown) => data is T;
}): Promise<SafeReturn<T>> {
  const { file, invalidFormatError, validate } = params;

  if (file.size > MAX_FILE_SIZE) {
    return {
      data: null,
      error: new AppError(ErrorCode.fileTooLarge),
    };
  }

  const isJsonType = file.type.includes("json");
  const isJsonFile = file.name.endsWith(".json");
  const isValidJsonFile = isJsonType || isJsonFile;

  if (!isValidJsonFile) {
    return {
      data: null,
      error: new AppError(ErrorCode.invalidFileType),
    };
  }

  const { data: text, error: readError } = await safeAsync(() => file.text());

  if (readError) {
    return { data: null, error: readError };
  }

  const { data: parsed, error: parseError } = await safeAsync(
    async (): Promise<unknown> => JSON.parse(text) as unknown,
  );

  if (parseError) {
    return {
      data: null,
      error: new AppError(ErrorCode.invalidJsonFormat),
    };
  }

  if (!validate(parsed)) {
    return {
      data: null,
      error: new AppError(invalidFormatError),
    };
  }

  return { data: parsed, error: null };
}
