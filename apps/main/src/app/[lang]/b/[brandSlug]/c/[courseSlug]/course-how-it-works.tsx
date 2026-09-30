import {
  SECTION_CLASS,
  SECTION_TITLE_CLASS,
  TILE_CLASS,
  TILE_ICON_CLASS,
} from "@/components/public/landing-styles";
import { type SampleLesson } from "@/lib/public/sample-lesson";
import { cn } from "@zoonk/ui/lib/utils";
import { CalendarCheckIcon, RotateCcwIcon, ZapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { CourseLessonPreview } from "./course-lesson-preview";

function Step({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <li className="flex gap-4">
      {icon}
      <div className="min-w-0 pt-1">
        <h3 className="text-[19px] font-semibold tracking-[-0.015em] sm:text-xl">{title}</h3>
        <p className="text-muted-foreground mt-1 text-[15px] leading-relaxed text-pretty sm:text-base">
          {children}
        </p>
      </div>
    </li>
  );
}

/**
 * How learning this course works, in three short steps: a plan in the learner's minutes, short
 * lessons and reviews. Beside them, one of the course's own lessons as it opens in the app; until
 * one is written, the steps sit side by side on wide screens instead of leaving a column empty.
 */
export async function CourseHowItWorks({ sample }: { sample: SampleLesson | null }) {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby="course-how-it-works"
      className={cn(
        SECTION_CLASS,
        "mt-24 grid grid-cols-1 gap-12 sm:mt-36",
        sample && "lg:grid-cols-2 lg:items-center lg:gap-16",
      )}
    >
      <div>
        <h2 className={SECTION_TITLE_CLASS} id="course-how-it-works">
          {t("How it works")}
        </h2>

        <ol
          className={cn("mt-8 flex flex-col gap-8 sm:mt-10", !sample && "lg:grid lg:grid-cols-3")}
        >
          <Step
            icon={
              <span
                className={cn(
                  TILE_ICON_CLASS,
                  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
                )}
              >
                <CalendarCheckIcon aria-hidden="true" className="size-5" />
              </span>
            }
            title={t("A plan in the minutes you have")}
          >
            {t(
              "Open the app and today's session is ready. It fits the minutes you have and skips what you already know.",
            )}
          </Step>

          <Step
            icon={
              <span
                className={cn(
                  TILE_ICON_CLASS,
                  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                )}
              >
                <ZapIcon aria-hidden="true" className="size-5" />
              </span>
            }
            title={t("Short lessons, one idea at a time")}
          >
            {t(
              "Each lesson takes a few minutes, with questions as you go. Stuck? Tap Simpler. Curious? Tap Go deeper.",
            )}
          </Step>

          <Step
            icon={
              <span
                className={cn(
                  TILE_ICON_CLASS,
                  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
                )}
              >
                <RotateCcwIcon aria-hidden="true" className="size-5" />
              </span>
            }
            title={t("Reviews before you forget")}
          >
            {t(
              "Reviews come back right before you'd forget. Every mistake goes to a notebook and returns as practice.",
            )}
          </Step>
        </ol>
      </div>

      {sample && (
        <div className={cn(TILE_CLASS, "flex justify-center overflow-hidden px-5 pt-10 sm:pt-12")}>
          <CourseLessonPreview lesson={sample} />
        </div>
      )}
    </section>
  );
}
