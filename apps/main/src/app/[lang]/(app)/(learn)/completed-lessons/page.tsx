import { NotFoundPage } from "@/components/errors/not-found-page";
import { ListSectionSkeleton } from "@/components/learn/detail-skeleton";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getReadAt } from "@/lib/learn/read-at";
import { COMPLETED_LESSON_PAGE_SIZE } from "@zoonk/core/completed-lessons/contract";
import { listCurrentUserCompletedLessons } from "@zoonk/core/completed-lessons/list-current-user";
import { LearnPageBar } from "@zoonk/learn/bar";
import { INBOX_PAGE_CLASS, PAGE_COLUMN_CLASS, PageTitle } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { getIsoDay } from "@zoonk/utils/calendar-day";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { LearnNotFound } from "../_components/learn-not-found";
import { CompletedLessonsClient } from "./completed-lessons-client";

type Props = PageProps<"/[lang]/completed-lessons">;

const MAX_SHOWN = 1000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Completed lessons") };
}

/** "Show more" grows the list in place, so the day headers never start over. */
function readShown(value: string | string[] | undefined): number {
  const shown = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isInteger(shown)) {
    return COMPLETED_LESSON_PAGE_SIZE;
  }

  return Math.min(Math.max(shown, COMPLETED_LESSON_PAGE_SIZE), MAX_SHOWN);
}

async function CompletedLessonsBar() {
  const t = await getExtracted();
  return <LearnPageBar back={{ href: "/today" }} root title={t("Completed lessons")} />;
}

async function CompletedLessonsBody({ searchParams }: Pick<Props, "searchParams">) {
  const [goal, query, readAt] = await Promise.all([getCurrentGoal(), searchParams, getReadAt()]);

  if (!goal) {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={<CompletedLessonsBar />}
        description={t("The lessons you've finished, ready to do again anytime.")}
        next="/completed-lessons"
        title={t("Completed lessons")}
      />
    );
  }

  const shown = readShown(query.shown);

  const result = await listCurrentUserCompletedLessons({
    goalId: goal.id,
    limit: shown,
    offset: 0,
  });

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  const canShowMore = result.hasMore && shown < MAX_SHOWN;

  return (
    <CompletedLessonsClient
      goalTitle={goal.title}
      lessons={result.lessons}
      moreHref={
        canShowMore ? `/completed-lessons?shown=${shown + COMPLETED_LESSON_PAGE_SIZE}` : null
      }
      today={getIsoDay({ now: new Date(readAt), timeZone: goal.timezone ?? "UTC" })}
    />
  );
}

async function CompletedLessonsSkeleton() {
  const t = await getExtracted();

  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <CompletedLessonsBar />
      <div className={cn(PAGE_COLUMN_CLASS, INBOX_PAGE_CLASS, "flex flex-col gap-8")}>
        <div className="flex flex-col gap-1">
          <span className="flex h-4 items-center">
            <Skeleton className="h-3 w-32 rounded-sm" />
          </span>
          <PageTitle>{t("Completed lessons")}</PageTitle>
        </div>
        <ListSectionSkeleton rows={6} />
      </div>
    </div>
  );
}

export default function CompletedLessonsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<CompletedLessonsSkeleton />}>
      <CompletedLessonsBody searchParams={searchParams} />
    </Suspense>
  );
}
