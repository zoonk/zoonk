import { getCourseHref } from "@/data/courses/course-href";
import { getPathname } from "@/i18n/navigation";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { LOCALE_LABELS, getContentLocale } from "@zoonk/utils/locale";
import { XIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { cookies } from "next/headers";

const DISMISSAL_MAX_AGE = 60 * 60 * 24 * 365;

/** Suggest the instructional language without changing the selected course edition. */
export async function CourseAppLanguageNotice({
  brandSlug,
  courseSlug,
  language,
  locale,
}: {
  brandSlug: string;
  courseSlug: string;
  language: string;
  locale: string;
}) {
  const courseLocale = getContentLocale(language);

  if (!courseLocale || courseLocale === locale) {
    return null;
  }

  const cookieName = `ZOONK_DISMISSED_APP_LANGUAGE_${courseLocale}`;
  const cookieStore = await cookies();

  if (cookieStore.get(cookieName)?.value === "1") {
    return null;
  }

  const [t, ui] = await Promise.all([
    getExtracted({ locale: courseLocale }),
    getExtracted({ locale }),
  ]);

  const nativeLanguage =
    new Intl.DisplayNames([courseLocale], { type: "language" }).of(courseLocale) ??
    LOCALE_LABELS[courseLocale];

  /** A cookie keeps dismissed suggestions out of subsequent server renders and prefetched pages. */
  async function dismissNotice() {
    "use server";

    const store = await cookies();

    store.set(cookieName, "1", {
      httpOnly: true,
      maxAge: DISMISSAL_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  }

  return (
    <section
      aria-label={ui("App language")}
      className="bg-muted/50 mx-4 mb-4 flex items-start gap-3 rounded-2xl px-4 py-3 sm:items-center"
    >
      <div
        className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4"
        lang={courseLocale}
      >
        <p className="text-sm">
          {t("Zoonk is also available in {language}.", { language: nativeLanguage })}
        </p>
        <a
          className={buttonVariants({
            className: "h-auto min-h-9 whitespace-normal",
            variant: "outline",
          })}
          href={getPathname({
            forcePrefix: true,
            href: getCourseHref({ brandSlug, courseSlug }),
            locale: courseLocale,
          })}
        >
          {t("Use Zoonk in {language}", { language: nativeLanguage })}
        </a>
      </div>

      <form action={dismissNotice}>
        <Button
          aria-label={ui("Dismiss language suggestion")}
          size="icon"
          type="submit"
          variant="ghost"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </form>
    </section>
  );
}
