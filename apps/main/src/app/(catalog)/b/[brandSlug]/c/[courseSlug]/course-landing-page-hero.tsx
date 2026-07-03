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
 * obvious next step. The image stays separate from the copy so arbitrary course
 * artwork cannot reduce text contrast or compete with the primary action.
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

  return (
    <section className="bg-background">
      <div
        className={cn(
          COURSE_LANDING_FRAME_CLASS_NAME,
          "grid gap-8 px-4 py-10 sm:gap-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-14 lg:px-6 lg:py-18 xl:grid-cols-[minmax(0,1fr)_22rem]",
        )}
      >
        <div className="flex max-w-3xl flex-col gap-6 sm:gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground font-mono text-[0.68rem] tracking-[0.28em] uppercase">
              {t("Interactive course")}
            </p>

            <h1 className="max-w-4xl text-4xl leading-none font-semibold tracking-normal wrap-break-word sm:text-6xl lg:text-7xl">
              {course.title}
            </h1>

            {heroCopy && (
              <p className="text-muted-foreground max-w-2xl text-base leading-7 text-pretty sm:text-xl sm:leading-8">
                {heroCopy}
              </p>
            )}
          </div>

          <CourseLandingActions>
            {firstChapterHref ? (
              <CourseLandingStartAction
                courseId={course.id}
                excludedLessonKinds={excludedLessonKinds}
                firstChapterHref={firstChapterHref}
              />
            ) : null}
          </CourseLandingActions>

          <CourseLandingProofLine />
        </div>

        <CourseLandingHeroMedia course={course} />
      </div>
    </section>
  );
}

/**
 * Keeps course artwork visible on larger screens while treating it as
 * decorative for assistive tech because the adjacent heading already names the
 * course.
 */
function CourseLandingHeroMedia({ course }: { course: CourseWithDetails }) {
  if (course.imageUrl) {
    return (
      <div className="bg-muted relative hidden aspect-square w-full overflow-hidden rounded-lg outline -outline-offset-1 outline-black/10 lg:block dark:outline-white/10">
        <Image
          alt=""
          className="object-cover"
          fill
          loading="eager"
          sizes="(min-width: 1280px) 352px, 320px"
          src={course.imageUrl}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="text-muted-foreground/40 bg-muted/40 hidden aspect-square w-full items-center justify-center rounded-lg lg:flex"
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
async function CourseLandingProofLine() {
  const t = await getExtracted();

  const items = [t("First chapter free"), t("Beginner to advanced"), t("Learn at your own pace")];

  return (
    <ul className="text-muted-foreground flex max-w-2xl flex-wrap gap-x-4 gap-y-2 pt-1 font-mono text-[0.68rem] tracking-[0.2em] uppercase">
      {items.map((item, index) => (
        <li className="flex items-center gap-4" key={item}>
          <span>{item}</span>
          {index < items.length - 1 && <span aria-hidden="true">/</span>}
        </li>
      ))}
    </ul>
  );
}
