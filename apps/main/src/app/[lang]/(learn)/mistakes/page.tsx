import { getCurrentGoal } from "@/lib/learn/current-goal";
import { mistakeListInputSchema } from "@zoonk/core/mistakes/contract";
import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { MistakesNotebook } from "@zoonk/learn/mistakes";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";

type Props = PageProps<"/[lang]/mistakes">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Mistakes notebook") };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readQuery(query: Awaited<Props["searchParams"]>) {
  const parsed = mistakeListInputSchema.safeParse({
    cause: first(query.cause),
    offset: first(query.offset),
    status: first(query.status) ?? "open",
  });

  return parsed.success ? parsed.data : mistakeListInputSchema.parse({ status: "open" });
}

async function MistakesBody({ searchParams }: Pick<Props, "searchParams">) {
  const [goal, query] = await Promise.all([getCurrentGoal(), searchParams]);

  if (!goal) {
    return <LearnNoGoal />;
  }

  const input = readQuery(query);
  const result = await listCurrentUserMistakes({ ...input, goalId: goal.id });

  if (result.status !== "ready") {
    notFound();
  }

  return (
    <MistakesNotebook
      filters={{
        cause: input.cause ?? null,
        nextOffset: result.hasMore ? input.offset + input.limit : null,
        status: input.status ?? "open",
      }}
      hrefs={{ notebook: "/mistakes", practice: "/mistakes/practice" }}
      notebook={result}
    />
  );
}

function MistakesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-12 w-48 rounded-full" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

/** The mistakes notebook for the goal in the switcher, by skill and cause, with practice. */
export default function MistakesPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<MistakesSkeleton />}>
      <MistakesBody searchParams={searchParams} />
    </Suspense>
  );
}
