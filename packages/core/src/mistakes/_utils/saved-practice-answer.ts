import { type JsonObject, isJsonObject } from "@zoonk/utils/json";

export function readSavedPracticeAnswer(value: unknown): JsonObject {
  if (!isJsonObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => key !== "practiceMistakeId" && key !== "fixedMistakeIds",
    ),
  );
}
