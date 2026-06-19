import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 p-4 pb-28 md:gap-10">
      <div className="flex max-w-2xl flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-balance md:text-5xl">
          {t("What language do you want to learn?")}
        </h1>
      </div>

      <SourceLanguageSwitcher />

      <LanguageList
        emptyLabel={t("No languages found")}
        languages={languages}
        searchPlaceholder={t("Search languages")}
      />
    </main>
  );
}
