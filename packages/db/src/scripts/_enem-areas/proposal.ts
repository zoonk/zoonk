import { isJsonObject } from "@zoonk/utils/json";

export function readProposal(value: unknown) {
  if (!Array.isArray(value)) {
    throw new TypeError("Reviewed proposal must be an array");
  }

  return value.map((row: unknown) => {
    if (
      !isJsonObject(row) ||
      typeof row.area !== "string" ||
      typeof row.chapterId !== "string" ||
      typeof row.source !== "string" ||
      !Array.isArray(row.evidence)
    ) {
      throw new Error("Reviewed proposal has an invalid row");
    }

    return { area: row.area, chapterId: row.chapterId, evidence: row.evidence, source: row.source };
  });
}
