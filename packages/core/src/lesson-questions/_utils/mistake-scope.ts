import { AnyNull } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

export function getQuestionMistakeId(snapshot: unknown): string | undefined {
  return isJsonObject(snapshot) && typeof snapshot.mistakeId === "string"
    ? snapshot.mistakeId
    : undefined;
}

export function mistakeQuestionWhere(mistakeId: string | undefined) {
  return { contextSnapshot: { equals: mistakeId ?? AnyNull, path: ["mistakeId"] } };
}
