import { SubjectIcon } from "@zoonk/learn/subject-icon";
import { LanguageFlag, hasLanguageFlag } from "@zoonk/ui/components/language-flag";
import { cn } from "@zoonk/ui/lib/utils";
import { getLanguageFlagLabel } from "@zoonk/utils/language-flags";
import Image from "next/image";

const COURSE_MARK_CLASS = "size-10 shrink-0 rounded-lg";

export function CourseMark({
  course,
  loading,
  locale,
}: {
  course: { imageUrl: string | null; targetLanguage: string | null };
  loading?: "eager" | "lazy";
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
