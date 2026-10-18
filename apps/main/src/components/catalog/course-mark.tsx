import { SubjectIcon } from "@zoonk/learn/subject-icon";
import { LanguageFlag, hasLanguageFlag } from "@zoonk/ui/components/language-flag";
import { cn } from "@zoonk/ui/lib/utils";
import { getLanguageFlagLabel } from "@zoonk/utils/language-flags";
import Image from "next/image";

/** The 40px place of a course's mark. */
const COURSE_MARK_CLASS = "size-10 shrink-0 rounded-lg";

/**
 * A course's mark, as small as a list row's leading one: a language course's flag, which names the
 * variety it teaches (US or UK English) for screen readers too, else the course's own picture, else
 * the quiet book every course without a picture has, as a subject does in the Plan. The catalog's
 * list and the course's page show the same mark, so every row's words start at one edge and the
 * page leads with what the list showed.
 */
export function CourseMark({
  course,
  loading,
  locale,
}: {
  course: { imageUrl: string | null; targetLanguage: string | null };
  /** "eager" where the mark is above the fold, as on the course's own page. */
  loading?: "eager" | "lazy";
  /** The reader's language, which names the flag. */
  locale: string;
}) {
  if (hasLanguageFlag(course.targetLanguage)) {
    return (
      <span className={cn(COURSE_MARK_CLASS, "grid place-items-center")}>
        <LanguageFlag
          alt={
            getLanguageFlagLabel({ language: course.targetLanguage, userLanguage: locale }) ?? ""
          }
          className="w-8"
          language={course.targetLanguage}
        />
      </span>
    );
  }

  if (course.imageUrl) {
    return (
      <Image
        alt=""
        className={cn(COURSE_MARK_CLASS, "object-cover ring-1 ring-black/5 dark:ring-white/10")}
        height={40}
        loading={loading}
        src={course.imageUrl}
        width={40}
      />
    );
  }

  return <SubjectIcon imageUrl={null} size="list" />;
}
