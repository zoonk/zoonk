import { Link } from "@/i18n/navigation";
import { type CourseEditionResult } from "@zoonk/core/courses/editions";
import { type CourseWithDetails } from "@zoonk/core/courses/get-by-slug";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getLanguageName } from "@zoonk/utils/languages";
import { getExtracted, getLocale } from "next-intl/server";
import { CourseEditionForm } from "./course-edition-form";

type CourseEditionNoticeProps = {
  brandSlug: string;
  course: CourseWithDetails;
  edition: CourseEditionResult;
  targetLocale: string;
};

async function CourseEditionAction({
  brandSlug,
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
          variant: "outline",
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
      courseId={course.id}
      courseSlug={course.slug}
      failed={edition.kind === "generation" && edition.generationStatus === "failed"}
      targetLocale={targetLocale}
    />
  );
}

async function CourseEditionDescription({
  course,
  edition,
  targetLocale,
}: {
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

  return t("Switching languages opens a separate course. Your progress stays here.");
}

/**
 * The requested course remains playable while switching editions is an
 * explicit secondary action that leaves the learner's existing progress intact.
 */
export async function CourseEditionNotice({
  brandSlug,
  course,
  edition,
  targetLocale,
}: CourseEditionNoticeProps) {
  const [t, locale] = await Promise.all([getExtracted(), getLocale()]);
  const sourceLanguage = getLanguageName({ targetLanguage: course.language, userLanguage: locale });

  return (
    <section
      aria-label={t("Course language")}
      className="bg-muted/50 flex flex-col gap-4 rounded-2xl p-4"
    >
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-balance">
          {t("This course is in {language}", { language: sourceLanguage })}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          <CourseEditionDescription course={course} edition={edition} targetLocale={targetLocale} />
        </p>
      </div>

      <CourseEditionAction
        brandSlug={brandSlug}
        course={course}
        edition={edition}
        targetLocale={targetLocale}
      />
    </section>
  );
}
