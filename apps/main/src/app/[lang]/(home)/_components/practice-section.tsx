import {
  SECTION_CLASS,
  SECTION_LEAD_CLASS,
  SECTION_TITLE_CLASS,
  TILE_CLASS,
  TILE_ICON_CLASS,
} from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { type SupportedLocale } from "@zoonk/utils/locale";
import {
  BookOpenIcon,
  BriefcaseBusinessIcon,
  GraduationCapIcon,
  PlaneIcon,
  StoreIcon,
} from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { HOW_IT_WORKS_ID } from "./home-ids";
import { BusinessPreview } from "./previews/business-preview";
import { ClassPreview } from "./previews/class-preview";
import { ExamPreview } from "./previews/exam-preview";
import { JobPreview } from "./previews/job-preview";
import { LanguagePreview } from "./previews/language-preview";
import { EXAMPLE_CURRENCY } from "./previews/lesson-prices";

function PracticeTile({
  children,
  className,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  className?: string;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <li
      className={cn(
        TILE_CLASS,
        "flex w-[84%] flex-none snap-start flex-col p-5 sm:w-auto sm:p-7",
        className,
      )}
    >
      {icon}
      <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.015em] sm:mt-5 sm:text-[21px]">
        {title}
      </h3>
      <p className="text-muted-foreground mt-1 max-w-[460px] text-sm leading-relaxed sm:mt-1.5 sm:text-[15px]">
        {description}
      </p>
      {children}
    </li>
  );
}

/**
 * Practice changes with the goal: an exam gets its format, a job gets real
 * problems, a move gets its conversations, a class gets depth on demand and a
 * business gets numbers to play with. Each tile shows the product itself.
 */
export async function PracticeSection({ locale }: { locale: SupportedLocale }) {
  const t = await getExtracted();

  return (
    <section
      aria-labelledby={`${HOW_IT_WORKS_ID}-title`}
      className="mt-24 scroll-mt-20 sm:mt-36"
      id={HOW_IT_WORKS_ID}
    >
      <div className={SECTION_CLASS}>
        <div className="max-w-[700px]">
          <h2 className={SECTION_TITLE_CLASS} id={`${HOW_IT_WORKS_ID}-title`}>
            {t("Practice shaped by your goal")}
          </h2>
          <p className={SECTION_LEAD_CLASS}>
            {t(
              "An exam gets questions in its format. A new job gets problems from real work. A move gets the conversations you'll have day to day.",
            )}
          </p>
        </div>
      </div>

      <ul className="mx-auto mt-8 flex max-w-6xl snap-x snap-mandatory scroll-px-5 scrollbar-none gap-3 overflow-x-auto px-5 pb-2 sm:mt-12 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-8 sm:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        <PracticeTile
          className="sm:col-span-2"
          description={t(
            "A plan to exam day, questions in the real format and mock exams in real conditions.",
          )}
          icon={
            <span
              className={cn(
                TILE_ICON_CLASS,
                "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
              )}
            >
              <GraduationCapIcon aria-hidden="true" className="size-5" />
            </span>
          }
          title={t("Prepare for your exam")}
        >
          <ExamPreview />
        </PracticeTile>

        <PracticeTile
          description={t("Practice the skills the role asks for, on problems from real work.")}
          icon={
            <span
              className={cn(
                TILE_ICON_CLASS,
                "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
              )}
            >
              <BriefcaseBusinessIcon aria-hidden="true" className="size-5" />
            </span>
          }
          title={t("Get ready for a better job")}
        >
          <JobPreview />
        </PracticeTile>

        <PracticeTile
          description={t(
            "Practice the conversations you'll really have, with tips on how you sound.",
          )}
          icon={
            <span
              className={cn(
                TILE_ICON_CLASS,
                "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
              )}
            >
              <PlaneIcon aria-hidden="true" className="size-5" />
            </span>
          }
          title={t("Speak before you move")}
        >
          <LanguagePreview />
        </PracticeTile>

        <PracticeTile
          description={t("Stuck on a topic? Tap Simpler. Curious? Go deeper. On any screen.")}
          icon={
            <span
              className={cn(
                TILE_ICON_CLASS,
                "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
              )}
            >
              <BookOpenIcon aria-hidden="true" className="size-5" />
            </span>
          }
          title={t("Keep up in class")}
        >
          <ClassPreview />
        </PracticeTile>

        <PracticeTile
          description={t("Short lessons made for your goal, with numbers you can play with.")}
          icon={
            <span
              className={cn(
                TILE_ICON_CLASS,
                "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
              )}
            >
              <StoreIcon aria-hidden="true" className="size-5" />
            </span>
          }
          title={t("Grow your business")}
        >
          <BusinessPreview currency={EXAMPLE_CURRENCY[locale]} />
        </PracticeTile>
      </ul>
    </section>
  );
}
