import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { mistakeListInputSchema } from "@zoonk/core/mistakes/contract";
import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { getLanguageTodayView } from "@zoonk/core/view-models/language/today";
import { MistakesNotebook } from "@zoonk/learn/mistakes";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";

type Props = PageProps<"/[lang]/mistakes">;

const NOTEBOOK_PAGE_SIZE = 50;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Mistakes notebook") };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readQuery(query: Awaited<Props["searchParams"]>) {
  // A page holds as many as the list allows, so a skill's count is rarely split across pages.
  const parsed = mistakeListInputSchema.safeParse({
    limit: NOTEBOOK_PAGE_SIZE,
    offset: first(query.offset),
    status: first(query.status) ?? "open",
  });

  return parsed.success
    ? parsed.data
    : mistakeListInputSchema.parse({ limit: NOTEBOOK_PAGE_SIZE, status: "open" });
}

async function MistakesBody({ searchParams }: Pick<Props, "searchParams">) {
  const [goal, query] = await Promise.all([getCurrentGoal(), searchParams]);

  if (!goal) {
    return (
      <>
        <JourneyPageBar />
        <LearnNoGoal />
      </>
    );
  }

  const input = readQuery(query);

  // A language goal's pattern noticed in these mistakes is one tap away from the notebook.
  const [result, language] = await Promise.all([
    listCurrentUserMistakes({ ...input, goalId: goal.id }),
    getLanguageTodayView({ goalId: goal.id }),
  ]);

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <MistakesNotebook
      filters={{
        nextOffset: result.hasMore ? input.offset + input.limit : null,
        status: input.status ?? "open",
      }}
      hrefs={{
        back: "/today",
        notebook: "/mistakes",
        pattern: "/pattern",
        practice: "/mistakes/practice",
      }}
      notebook={result}
      pattern={language.status === "ready" ? language.today.pattern : null}
    />
  );
}

function MistakesSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <JourneyPageBar />
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-2xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-full sm:w-56" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** The mistakes notebook for the goal in the switcher: how many to fix, practice, then by skill. */
export default function MistakesPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<MistakesSkeleton />}>
      <MistakesBody searchParams={searchParams} />
    </Suspense>
  );
}
