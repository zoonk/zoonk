import { getCompletedLanguageCourseHrefs } from "@/data/courses/language-course";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { LanguageList } from "./language-list";
import { getLanguageOptions } from "./language-options";

const LANGUAGE_OPTION_SKELETONS = Array.from({ length: 8 }, (_, index) => index);

/**
 * Mirrors the search field and first visible language rows so a cold request
 * preserves the picker's layout while the locale-specific destinations load.
 */
export function LanguageListSkeleton() {
  return (
    <section className="flex w-full flex-col gap-5">
      <Skeleton className="h-11 w-full rounded-lg" />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {LANGUAGE_OPTION_SKELETONS.map((index) => (
          <div
            className="border-border/40 flex min-w-0 items-center gap-3 rounded-lg border px-4 py-3"
            key={index}
          >
            <Skeleton className="size-7 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Resolves the URL locale and its completed-course destinations below the
 * page's Suspense boundary so the picker heading remains in the shared shell.
 */
export async function LanguageListContent({
  params,
}: Pick<PageProps<"/[lang]/start/speak">, "params">) {
  const { lang: locale } = await params;
  const t = await getExtracted({ locale });
  const completedLanguageCourseHrefs = await getCompletedLanguageCourseHrefs({ language: locale });
  const languages = getLanguageOptions({ completedLanguageCourseHrefs, locale });

  return (
    <LanguageList
      emptyLabel={t("No languages found")}
      languages={languages}
      searchPlaceholder={t("Search languages")}
    />
  );
}
