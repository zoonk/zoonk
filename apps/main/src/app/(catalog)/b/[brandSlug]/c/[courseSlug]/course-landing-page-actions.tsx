import { ContinueLessonLink } from "@/components/catalog/continue-lesson-link";
import { type LessonKind } from "@zoonk/db";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CompassIcon } from "lucide-react";
import { type Route } from "next";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { type ReactNode } from "react";

type CourseLandingStartActionProps<Href extends string> = {
  courseId: string;
  excludedLessonKinds?: LessonKind[];
  firstChapterHref: Route<Href>;
};

/**
 * Keeps the primary start action next to /start discovery without making the
 * row responsible for deciding whether the course has a usable first chapter.
 */
export async function CourseLandingActions({
  children,
  inverted,
}: {
  children: ReactNode;
  inverted: boolean;
}) {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-3 sm:inline-flex sm:flex-row sm:items-center">
      {children}

      <Link
        className={cn(
          buttonVariants({ size: "lg", variant: inverted ? "inverse-outline" : "outline" }),
          "w-full sm:w-fit",
        )}
        href="/start"
      >
        <CompassIcon aria-hidden="true" data-icon="inline-start" />
        {t("Explore courses")}
      </Link>
    </div>
  );
}

/**
 * Reuses the same course-level start button as the regular catalog page so the
 * landing page cannot drift from the existing first-lesson routing behavior.
 */
export async function CourseLandingStartAction<Href extends string>({
  courseId,
  excludedLessonKinds,
  firstChapterHref,
  inverted,
}: CourseLandingStartActionProps<Href> & { inverted: boolean }) {
  const t = await getExtracted();

  return (
    <ContinueLessonLink
      appearance={{
        className: "w-full flex-none sm:w-fit",
        size: "lg",
        variant: inverted ? "inverse" : "default",
      }}
      courseId={courseId}
      excludedLessonKinds={excludedLessonKinds}
      fallbackHref={firstChapterHref}
      showProgress={false}
      startLabel={t("Start free chapter")}
    />
  );
}
