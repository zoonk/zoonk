import { StartBlock } from "@/components/public/public-start";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { PageWithAside } from "@zoonk/learn/shell";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import {
  COURSE_HERO_CLASS,
  COURSE_TITLE_CLASS,
  HERO_LEAD_CLASS,
  LESSON_LEAD_CLASS,
  PLAN_LINE_CLASS,
  PlanLine,
} from "./catalog-hero";
import { COURSE_MARK_CLASS } from "./course-mark";
import { CoursePlanWindowSkeleton } from "./course-plan-window";

/** A chapter's lessons while they load: about as many as a chapter has. */
const ROWS = 4;

/**
 * The page's bar: as tall as its row, and its bottom edge. It holds the bar's slot, so on a phone
 * the frame's first paint leaves out the tabs' top bar while the page loads, as the loaded page's
 * bar will (`TabRootOnly`), and nothing jumps up when the page arrives.
 */
function BarSkeleton() {
  return (
    <div
      className="-mx-4 -mt-4 box-content h-16 border-b border-transparent sm:-mx-8 sm:-mt-6 lg:-mx-10 lg:-mt-8"
      data-slot="learn-page-bar"
    />
  );
}

/**
 * Lines of text while they load, one bar a line in the text's own type (`className`), so they take
 * the words' room: `lines` of them from `sm`, and `phoneLines` in a phone's narrower column. The
 * counts are what a typical course's words take.
 */
function TextSkeleton({
  className,
  lines,
  phoneLines,
}: {
  className: string;
  lines: number;
  phoneLines: number;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {Array.from({ length: Math.max(lines, phoneLines) }, (_, index) => (
        <div
          className={cn(
            "flex h-lh items-center",
            index >= phoneLines && "max-sm:hidden",
            index >= lines && "sm:hidden",
          )}
          key={index}
        >
          <Skeleton
            className={cn(
              "h-3.5 w-full rounded-sm",
              index === phoneLines - 1 && "max-sm:w-3/5",
              index === lines - 1 && "sm:w-3/5",
            )}
          />
        </div>
      ))}
    </div>
  );
}

/** A page's name, one line of its title's type, under its mark (`mt-4`) or its eyebrow (`mt-2`). */
function TitleSkeleton({ className }: { className: string }) {
  return (
    <div className={cn("text-title flex h-lh items-center", className)}>
      <Skeleton className="h-8 w-72 max-w-full rounded-md" />
    </div>
  );
}

/** The link over a chapter's or a lesson's title to where it belongs, a 44px target on its line. */
function EyebrowSkeleton() {
  return (
    <div className="-my-2.5 flex min-h-11 items-center">
      <Skeleton className="h-3.5 w-40 rounded-sm" />
    </div>
  );
}

/** A page's way in: its button, and its short note under it on a phone and beside it from `sm`. */
function StartSkeleton() {
  return (
    <StartBlock>
      <Skeleton className="h-11 w-full rounded-lg sm:w-40" />

      <div className="flex h-lh items-center self-center text-[13px] sm:self-auto sm:text-sm">
        <Skeleton className="h-3 w-44 rounded-sm" />
      </div>
    </StartBlock>
  );
}

/** A chapter's lessons as `NumberedRows` lists them: 44px rows with a hairline between them. */
function RowsSkeleton() {
  return (
    <div className="flex flex-col [&>*+*]:border-t">
      {Array.from({ length: ROWS }, (_, index) => (
        <div className="flex items-center gap-3 py-3" key={index}>
          <div className="flex h-5 w-5 shrink-0 items-center">
            <Skeleton className="h-3 w-3 rounded-sm" />
          </div>
          <Skeleton className="h-3.5 w-3/5 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

/**
 * A course's first screen: its mark, name, promise and plan line and its way in, beside the plan
 * window as it waits, as the page lays them out.
 */
function CourseSkeleton() {
  return (
    <div className={COURSE_HERO_CLASS}>
      <div className="max-w-column flex flex-col">
        <Skeleton className={COURSE_MARK_CLASS} />
        <TitleSkeleton className={cn(COURSE_TITLE_CLASS, "mt-4")} />
        <TextSkeleton className={HERO_LEAD_CLASS} lines={2} phoneLines={3} />
        <PlanLine />
        <StartSkeleton />
      </div>

      <CoursePlanWindowSkeleton />
    </div>
  );
}

/**
 * A chapter's first screen and its lessons. Its plan line depends on where the chapter sits in its
 * course, so it waits as a bar.
 */
async function ChapterSkeleton() {
  const t = await getExtracted();

  return (
    <>
      <div className="max-w-column flex flex-col">
        <EyebrowSkeleton />
        <TitleSkeleton className="mt-2" />
        <TextSkeleton className={HERO_LEAD_CLASS} lines={2} phoneLines={3} />
        <TextSkeleton className={PLAN_LINE_CLASS} lines={1} phoneLines={2} />
        <StartSkeleton />
      </div>

      <PageSection className="max-w-column">
        <PageSectionHeader>
          <PageSectionTitle>{t("Lessons")}</PageSectionTitle>

          {/* Where the chapter sits and how long it takes, under the title on a phone. */}
          <div className="flex h-4 w-full items-center sm:w-64">
            <Skeleton className="h-3 w-full rounded-sm" />
          </div>
        </PageSectionHeader>

        <RowsSkeleton />
      </PageSection>
    </>
  );
}

/**
 * A lesson's first screen as most lessons in the catalog have it before their first learner: the
 * way to start it and how long it takes.
 */
function LessonSkeleton() {
  return (
    <div className="max-w-column flex flex-col">
      <EyebrowSkeleton />
      <TitleSkeleton className="mt-2" />
      <TextSkeleton className={LESSON_LEAD_CLASS} lines={1} phoneLines={2} />
      <StartSkeleton />
    </div>
  );
}

/** Beside a lesson from 72rem, its chapter as the page lists it: label, facts, name and lessons. */
function LessonAsideSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-label flex h-lh items-center">
          <Skeleton className="h-3 w-28 rounded-sm" />
        </div>

        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-24 rounded-sm" />
        </div>
      </div>

      <div className="-mt-1 flex h-lh items-center text-[0.9375rem]">
        <Skeleton className="h-3.5 w-40 rounded-sm" />
      </div>

      <RowsSkeleton />
    </div>
  );
}

/**
 * A course's, a chapter's or a lesson's page while it loads, built from the page's own pieces so
 * nothing moves when it arrives: the same bar, column and type, with its static words (the plan
 * line, the plan window's label, a chapter's "Lessons") drawn for real and the rest as bars, as
 * many lines as a typical course's words take on a phone and from `sm`. A lesson's chapter waits
 * beside it from 72rem.
 */
export async function CatalogPageSkeleton({ kind }: { kind: "chapter" | "course" | "lesson" }) {
  const t = await getExtracted();

  const page = (
    <div aria-busy="true" className="flex flex-col gap-8">
      <BarSkeleton />

      <Page className="gap-16 sm:gap-20">
        {kind === "course" && <CourseSkeleton />}
        {kind === "chapter" && <ChapterSkeleton />}
        {kind === "lesson" && <LessonSkeleton />}
      </Page>
    </div>
  );

  if (kind !== "lesson") {
    return page;
  }

  return (
    <PageWithAside
      aside={<LessonAsideSkeleton />}
      asideClassName="hidden min-[72rem]:flex"
      asideLabel={t("Loading")}
    >
      {page}
    </PageWithAside>
  );
}
