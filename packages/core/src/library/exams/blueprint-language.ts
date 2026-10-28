import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { z } from "zod";
import { type ExamStructure } from "./blueprint-contract";
import { type FactEntry, type FactSource, toFacts } from "./blueprint-fact-claims";
import { type KeptFacts } from "./blueprint-kept";

const TESTED_LANGUAGE_ID = "testedLanguage";
const LANGUAGE_CODE_PATTERN = /^[a-z]{2}$/u;
const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { fallback: "none", type: "language" });

function toLanguageCode(tested: BlueprintExtraction["testedLanguage"]): string | null {
  const code = tested ? getBaseLanguage(tested.language.trim()) : "";
  return LANGUAGE_CODE_PATTERN.test(code) && LANGUAGE_NAMES.of(code) ? code : null;
}

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

export function readTestedLanguage(structure: unknown): string | null {
  return storedTestedLanguageSchema.safeParse(structure).data?.testedLanguage.language ?? null;
}
