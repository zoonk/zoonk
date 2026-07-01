import { type CourseWithDetails } from "@/data/courses/get-course";
import { type LessonKind } from "@zoonk/db";
import { cn } from "@zoonk/ui/lib/utils";
import { NotebookPenIcon } from "lucide-react";
import { type Route } from "next";
import { getExtracted } from "next-intl/server";
import Image from "next/image";
import { CourseLandingActions, CourseLandingStartAction } from "./course-landing-page-actions";
import { COURSE_LANDING_FRAME_CLASS_NAME } from "./course-landing-page-layout";

/**
 * The hero needs to state the course promise and make chapter one feel like the
 * obvious next step. The image stays full-bleed so the page opens with the
 * subject, not a generic card layout.
 */
export async function CourseLandingHero<Href extends string>({
  course,
  excludedLessonKinds,
  firstChapterHref,
  heroCopy,
}: {
  course: CourseWithDetails;
  excludedLessonKinds: LessonKind[];
  firstChapterHref: Route<Href> | null;
  heroCopy: string | null;
}) {
  const t = await getExtracted();
  const hasHeroImage = Boolean(course.imageUrl);

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden py-10 sm:py-16",
        hasHeroImage ? "bg-black text-white" : "bg-muted/30",
      )}
    >
      <CourseLandingHeroBackdrop course={course} />

      <div
        className={cn(
          COURSE_LANDING_FRAME_CLASS_NAME,
          "relative flex items-center px-4 lg:min-h-135 lg:px-6",
        )}
      >
        <div className="flex max-w-3xl flex-col gap-6 sm:gap-8">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[0.68rem] tracking-[0.28em] text-white/50 uppercase">
              {t("Complete course")}
            </p>

            <h1 className="max-w-4xl text-4xl leading-none font-semibold tracking-normal wrap-break-word sm:text-6xl lg:text-7xl">
              {course.title}
            </h1>

            {heroCopy && (
              <p
                className={cn(
                  "max-w-2xl text-base leading-7 text-pretty sm:text-xl sm:leading-8",
                  hasHeroImage ? "text-white/80" : "text-muted-foreground",
                )}
              >
                {heroCopy}
              </p>
            )}
          </div>

          <CourseLandingActions inverted={hasHeroImage}>
            {firstChapterHref ? (
              <CourseLandingStartAction
                courseId={course.id}
                excludedLessonKinds={excludedLessonKinds}
                firstChapterHref={firstChapterHref}
                inverted={hasHeroImage}
              />
            ) : null}
          </CourseLandingActions>

          <CourseLandingProofLine inverted={hasHeroImage} />
        </div>
      </div>
    </section>
  );
}

/**
 * The hero image should support the course story without becoming a separate
 * preview card. Rendering it as the section backdrop keeps the first viewport
 * focused on the title, value proposition, and primary action.
 */
function CourseLandingHeroBackdrop({ course }: { course: CourseWithDetails }) {
  if (course.imageUrl) {
    return (
      <>
        <Image
          alt={course.title}
          className="object-cover object-[72%_center] saturate-90"
          fill
          loading="eager"
          priority
          sizes="100vw"
          src={course.imageUrl}
        />
        <div className="absolute inset-0 bg-linear-to-r from-black via-black/80 to-black/20" />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
      </>
    );
  }

  return (
    <div
      aria-label={course.title}
      className="text-muted-foreground/40 pointer-events-none absolute inset-y-8 right-4 hidden w-1/3 items-center justify-center md:flex"
      role="img"
    >
      <NotebookPenIcon aria-hidden="true" className="size-24" />
    </div>
  );
}

/**
 * A compact proof line answers the biggest commitment questions without adding
 * another grid to the hero. The detailed proof now lives in the decision tabs
 * below the fold.
 */
async function CourseLandingProofLine({ inverted }: { inverted: boolean }) {
  const t = await getExtracted();

  const items = [t("First chapter free"), t("Beginner to advanced"), t("Learn at your own pace")];

  return (
    <ul
      className={cn(
        "flex max-w-2xl flex-wrap gap-x-4 gap-y-2 pt-1 font-mono text-[0.68rem] tracking-[0.2em] uppercase",
        inverted ? "text-white/55" : "text-muted-foreground",
      )}
    >
      {items.map((item, index) => (
        <li className="flex items-center gap-4" key={item}>
          <span>{item}</span>
          {index < items.length - 1 && <span aria-hidden="true">/</span>}
        </li>
      ))}
    </ul>
  );
}
