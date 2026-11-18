import { getCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { listPublishedCourseEditions } from "@zoonk/core/courses/published-editions";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { getLanguageNameInSentence } from "@zoonk/utils/languages";
import { type SupportedLocale, getContentLocale } from "@zoonk/utils/locale";
import { ChevronRightIcon, LanguagesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function EditionNotice({
  courseId,
  locale,
}: {
  courseId: string;
  locale: SupportedLocale;
}) {
  const t = await getExtracted();
  const editions = await listPublishedCourseEditions({ courseId });
  const edition = editions.find((item) => getContentLocale(item.language) === locale);

  if (!edition) {
    return null;
  }

  return (
    <Link
      className="bg-card ring-border hover:bg-muted focus-visible:ring-ring/50 mb-6 flex min-h-11 max-w-[560px] gap-3 rounded-xl px-4 py-3 text-sm leading-snug ring-1 transition-colors outline-none focus-visible:ring-[3px]"
      href={getCourseHref(edition)}
      prefetch
    >
      <LineMarker>
        <LanguagesIcon aria-hidden="true" className="text-muted-foreground size-4" />
      </LineMarker>
      <span className="flex-1 text-pretty">
        {t("This course is also in {language}.", {
          language: getLanguageNameInSentence({
            targetLanguage: edition.language,
            userLanguage: locale,
          }),
        })}
      </span>
      <LineMarker>
        <ChevronRightIcon aria-hidden="true" className="size-4" />
      </LineMarker>
    </Link>
  );
}
