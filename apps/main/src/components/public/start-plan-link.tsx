import { Link } from "@/i18n/navigation";
import { getCourseStartHref } from "@/lib/public/public-hrefs";
import { ArrowRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { getSecondaryStartControlClassName, getStartControlClassName } from "./public-start";

/**
 * Opening the start page creates nothing, so a prefetch is harmless; `nofollow` keeps crawlers on the
 * indexed pages, since the start page isn't one.
 */
export async function StartPlanLink({
  chapterId,
  continues = false,
  courseId,
  minutes,
  secondary = false,
}: {
  chapterId?: string | null;
  continues?: boolean;
  courseId: string;
  minutes?: number;
  secondary?: boolean;
}) {
  const t = await getExtracted();

  return (
    <Link
      className={secondary ? getSecondaryStartControlClassName() : getStartControlClassName()}
      href={getCourseStartHref({ chapterId, courseId, minutes })}
      prefetch
      rel="nofollow"
    >
      {continues ? t("Continue your plan") : t("Build my plan")}
      <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
    </Link>
  );
}
