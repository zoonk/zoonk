import { getOriginalCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { type CourseEditionResult } from "@zoonk/core/courses/editions";
import { type CourseWithDetails } from "@zoonk/core/courses/get-by-slug";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getLanguageName } from "@zoonk/utils/languages";
import { LanguagesIcon } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { CourseEditionForm } from "./course-edition-form";

type CourseEditionNoticeProps = {
  brandSlug: string;
  compact?: boolean;
  course: CourseWithDetails;
  edition: CourseEditionResult;
  targetLocale: string;
};

async function CourseEditionAction({
  brandSlug,
  compact = false,
  course,
  edition,
  targetLocale,
}: CourseEditionNoticeProps) {
  const [t, locale] = await Promise.all([getExtracted(), getLocale()]);
  const language = getLanguageName({ targetLanguage: targetLocale, userLanguage: locale });

  if (edition.kind === "course") {
    return (
      <Link
        className={buttonVariants({
          className: "h-auto min-h-11 whitespace-normal",
          variant: "outline",
        })}
        href={`/b/${brandSlug}/c/${edition.course.slug}`}
        locale={targetLocale}
      >
        {t("Learn in {language}", { language })}
      </Link>
    );
  }

  if (edition.kind === "generation" && edition.generationStatus === "running") {
    return (
      <Link
        className={buttonVariants({
          className: "h-auto min-h-11 whitespace-normal",
          variant: compact ? "outline" : "default",
        })}
        href={`/generate/course/${edition.coursePromptId}`}
        locale={targetLocale}
        prefetch={false}
      >
        {t("View progress")}
      </Link>
    );
  }

  if (edition.kind === "unsupported" || edition.kind === "notFound") {
    return null;
  }

  return (
    <CourseEditionForm
      brandSlug={brandSlug}
      compact={compact}
      courseId={course.id}
      courseSlug={course.slug}
      failed={edition.kind === "generation" && edition.generationStatus === "failed"}
      targetLocale={targetLocale}
    />
  );
}

async function CourseEditionDescription({
  compact,
  course,
  edition,
  targetLocale,
}: {
  compact: boolean;
  course: CourseWithDetails;
  edition: CourseEditionResult;
  targetLocale: string;
}) {
  const [t, locale] = await Promise.all([getExtracted(), getLocale()]);
  const language = getLanguageName({ targetLanguage: targetLocale, userLanguage: locale });
  const sourceLanguage = getLanguageName({ targetLanguage: course.language, userLanguage: locale });

  if (edition.kind === "unsupported" && edition.reason === "sameLanguage") {
    return t("This course teaches {language}, with explanations in {sourceLanguage}.", {
      language,
      sourceLanguage,
    });
  }

  if (edition.kind === "unsupported") {
    return t("This course is taught in {sourceLanguage}. It isn't available in {language} yet.", {
      language,
      sourceLanguage,
    });
  }

  if (edition.kind === "generation" && edition.generationStatus === "running") {
    return t("Your {language} course is being prepared. You can follow its progress.", {
      language,
    });
  }

  if (edition.kind === "generation" && edition.generationStatus === "failed") {
    return t("We couldn't finish preparing this course in {language}. You can try again.", {
      language,
    });
  }

  if (compact) {
    return t("Switching languages opens a separate course. Your progress stays here.");
  }

  return t(
    "This course is taught in {sourceLanguage}. We'll find it in {language} or create it for you.",
    { language, sourceLanguage },
  );
}

/**
 * Discovery gives the local language one clear primary action. An explicitly
 * selected edition keeps its curriculum and offers switching as a secondary action.
 */
export async function CourseEditionNotice({
  brandSlug,
  compact = false,
  course,
  edition,
  targetLocale,
}: CourseEditionNoticeProps) {
  const [t, locale] = await Promise.all([getExtracted(), getLocale()]);
  const language = getLanguageName({ targetLanguage: targetLocale, userLanguage: locale });
  const sourceLanguage = getLanguageName({ targetLanguage: course.language, userLanguage: locale });
  const unsupported = edition.kind === "unsupported";
  const originalHref = getOriginalCourseHref({ brandSlug, courseSlug: course.slug });

  return (
    <section
      aria-label={t("Course language")}
      className={cn(
        "flex flex-col gap-4",
        compact ? "bg-muted/50 rounded-2xl p-4" : "mx-auto max-w-lg px-2 py-6 sm:px-8 sm:py-12",
      )}
    >
      {!compact && <LanguagesIcon aria-hidden="true" className="text-muted-foreground size-8" />}

      <div className="space-y-2">
        <h2
          className={cn("font-semibold text-balance", compact ? "text-sm" : "text-xl sm:text-2xl")}
        >
          {compact || unsupported
            ? t("This course is in {language}", { language: sourceLanguage })
            : t("Learn in {language}", { language })}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          <CourseEditionDescription
            compact={compact}
            course={course}
            edition={edition}
            targetLocale={targetLocale}
          />
        </p>
      </div>

      <CourseEditionAction
        brandSlug={brandSlug}
        compact={compact}
        course={course}
        edition={edition}
        targetLocale={targetLocale}
      />

      {!compact && (
        <Link
          className={buttonVariants({
            className: "h-auto min-h-11 whitespace-normal",
            variant: unsupported ? "default" : "outline",
          })}
          href={originalHref}
        >
          {t("Continue in {language}", { language: sourceLanguage })}
        </Link>
      )}
    </section>
  );
}
