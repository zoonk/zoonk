import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { z } from "zod";
import { type ExamStructure } from "./blueprint-contract";
import { type FactEntry, type FactSource, toFacts } from "./blueprint-fact-claims";
import { type KeptFacts } from "./blueprint-kept";

const TESTED_LANGUAGE_ID = "testedLanguage";
const LANGUAGE_CODE_PATTERN = /^[a-z]{2}$/u;
const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { fallback: "none", type: "language" });

/** The reading's tested language as an ISO 639-1 code ("en" for "en-GB"), when it names a real one. */
function toLanguageCode(tested: BlueprintExtraction["testedLanguage"]): string | null {
  const code = tested ? getBaseLanguage(tested.language.trim()) : "";
  return LANGUAGE_CODE_PATTERN.test(code) && LANGUAGE_NAMES.of(code) ? code : null;
}

/** The language the exam tests, as a claim of its own on the passage that says so. */
export function testedLanguageFacts({ documents, extraction }: FactSource): FactEntry[] {
  const { testedLanguage } = extraction;
  const code = toLanguageCode(testedLanguage);

  if (!testedLanguage || !code) {
    return [];
  }

  return toFacts({
    claims: [
      {
        id: TESTED_LANGUAGE_ID,
        statement: `The exam tests candidates' command of ${LANGUAGE_NAMES.of(code)}`,
      },
    ],
    documents,
    passages: [testedLanguage],
  });
}

/** The tested language as stored, once both checks kept its claim; a gap otherwise. */
export function toTestedLanguage({
  extraction,
  kept,
}: {
  extraction: BlueprintExtraction;
  kept: KeptFacts;
}): ExamStructure["testedLanguage"] {
  const citation = kept.get(TESTED_LANGUAGE_ID)?.[0];
  const language = toLanguageCode(extraction.testedLanguage);

  return citation && language ? { citation, language } : null;
}

const storedTestedLanguageSchema = z.object({ testedLanguage: z.object({ language: z.string() }) });

/**
 * The language a stored blueprint's notice says the exam tests ("en" for IELTS), read on its own
 * from its structure; null when it names none (a blueprint read before it was, too).
 */
export function readTestedLanguage(structure: unknown): string | null {
  return storedTestedLanguageSchema.safeParse(structure).data?.testedLanguage.language ?? null;
}
