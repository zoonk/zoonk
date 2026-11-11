import { type LawRequest } from "@zoonk/core/library/sources/law-identity";
import {
  findStoredLawSource,
  isLawSource,
  readLawLookup,
  recordLawLookup,
} from "@zoonk/core/library/sources/laws";

export async function readLawLookupStep(
  law: LawRequest,
): Promise<{ sourceId: string | null } | null> {
  "use step";
  return readLawLookup(law);
}

export async function recordLawLookupStep(input: {
  law: LawRequest;
  sourceId: string | null;
}): Promise<void> {
  "use step";
  await recordLawLookup(input);
}

export async function findStoredLawSourceStep(law: LawRequest): Promise<string | null> {
  "use step";
  return findStoredLawSource(law);
}

export async function acceptLawSourceStep(input: {
  law: LawRequest;
  sourceId: string;
}): Promise<boolean> {
  "use step";
  return isLawSource(input);
}
