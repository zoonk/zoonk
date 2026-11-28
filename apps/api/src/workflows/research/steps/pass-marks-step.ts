import { type ServiceTier } from "@zoonk/ai/provider-options";
import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { translatePassMarks } from "@zoonk/ai/tasks/research/translate-pass-marks";
import { listPassMarkTexts } from "@zoonk/core/library/exams/pass-marks";
import { safeAsync } from "@zoonk/utils/error";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { logError } from "@zoonk/utils/logger";
import { type ResearchAnalytics } from "../_utils/research-analytics";

export async function translateReadPassMarks({
  analytics,
  exam,
  extraction,
  serviceTier,
}: {
  analytics: ResearchAnalytics;
  exam: string;
  extraction: BlueprintExtraction;
  serviceTier: ServiceTier | undefined;
}) {
  "use step";

  const texts = listPassMarkTexts(extraction.rules);

  if (texts.length === 0) {
    return { texts, translations: {} };
  }

  const { data, error } = await safeAsync(() =>
    translatePassMarks({ analytics, languages: SUPPORTED_LOCALES, serviceTier, texts }),
  );

  if (error) {
    logError(`The pass marks of "${exam}" couldn't be translated:`, error);
  }

  return { texts, translations: data?.data.translations ?? {} };
}
