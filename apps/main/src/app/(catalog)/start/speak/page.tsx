import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import {
  StartSurface,
  StartSurfaceContent,
  StartSurfaceHeader,
  StartSurfaceTitle,
} from "../_components/start-surface";
import { LanguageList } from "./language-list";
import { getLanguageOptions } from "./language-options";
import { SourceLanguageSwitcher } from "./source-language-switcher";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Online language courses with AI. Learn a language with pronunciation tips, vocabulary, reading, and listening practice.",
    ),
    title: t("Learn a language online with AI"),
  };
}

/**
 * Shows every TTS-supported language as a searchable list so learners can start
 * a controlled language course without going through open-ended prompting.
 */
export default async function StartSpeak() {
  const locale = await getLocale();
  const t = await getExtracted();
  const languages = getLanguageOptions({ locale });

  return (
    <StartSurface>
      <StartSurfaceHeader>
        <StartSurfaceContent>
          <StartSurfaceTitle>{t("What language do you want to learn?")}</StartSurfaceTitle>
        </StartSurfaceContent>
      </StartSurfaceHeader>

      <SourceLanguageSwitcher />

      <LanguageList
        emptyLabel={t("No languages found")}
        languages={languages}
        searchPlaceholder={t("Search languages")}
      />
    </StartSurface>
  );
}
