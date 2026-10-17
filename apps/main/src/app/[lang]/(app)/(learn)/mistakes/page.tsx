import { NotFoundPage } from "@/components/errors/not-found-page";
import { DetailSkeleton } from "@/components/learn/detail-skeleton";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { getTodayPattern } from "@zoonk/core/language/patterns/today";
import { mistakeListInputSchema } from "@zoonk/core/mistakes/contract";
import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { LearnPageBar } from "@zoonk/learn/bar";
import { MistakesNotebook } from "@zoonk/learn/mistakes";
import { INBOX_PAGE_CLASS } from "@zoonk/learn/page";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import { LearnNotFound } from "../_components/learn-not-found";

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

/** The notebook's bar while it loads or has no goal to show, as the notebook draws it. */
async function NotebookBar() {
  const t = await getExtracted();

  return <LearnPageBar back={{ href: "/today" }} root title={t("Mistakes notebook")} />;
}

async function MistakesBody({ searchParams }: Pick<Props, "searchParams">) {
  const [goal, query] = await Promise.all([getCurrentGoal(), searchParams]);

  if (!goal) {
    const t = await getExtracted();

    return (
      <>
        <LearnerWitness />

        <LearnNoGoal
          bar={<NotebookBar />}
          description={t(
            "The questions you got wrong, why, and practice until you get them right.",
          )}
          next="/mistakes"
          title={t("Mistakes notebook")}
        />
      </>
    );
  }

  const input = readQuery(query);

  // A language goal's pattern noticed in these mistakes is one tap away from the notebook.
  const [result, language] = await Promise.all([
    listCurrentUserMistakes({ ...input, goalId: goal.id }),
    getTodayPattern({ goalId: goal.id }),
  ]);

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnerWitness />
        <LearnNotFound />
      </NotFoundPage>
    );
  }

  return (
    <>
      <LearnerWitness />

      <MistakesNotebook
        filters={{
          nextOffset: result.hasMore ? input.offset + input.limit : null,
          status: input.status ?? "open",
        }}
        goalTitle={goal.title}
        hrefs={{
          back: "/today",
          lesson: "/learn",
          notebook: "/mistakes",
          pattern: "/pattern",
          practice: "/mistakes/practice",
        }}
        notebook={result}
        pattern={language.status === "ready" ? language.pattern : null}
      />
    </>
  );
}

/** The notebook's shape while it loads, with its own name. */
async function NotebookSkeleton() {
  const t = await getExtracted();

  return (
    <DetailSkeleton
      aside={false}
      bar={<NotebookBar />}
      className={INBOX_PAGE_CLASS}
      rows={3}
      tabs
      title={t("Mistakes notebook")}
    />
  );
}

/** The mistakes notebook for the goal in the switcher: how many to fix, practice, then by skill. */
export default function MistakesPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<NotebookSkeleton />}>
      <MistakesBody searchParams={searchParams} />
    </Suspense>
  );
}
