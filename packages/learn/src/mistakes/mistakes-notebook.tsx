"use client";

import { type CurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { LearnLink } from "../learn-link";
import { MistakeEntryCard } from "./mistake-entry";
import { MISTAKE_CAUSES, type MistakeCauseKey, useCauseLabel } from "./use-cause-label";

type Notebook = Extract<CurrentUserMistakes, { status: "ready" }>;
export type MistakeEntry = Notebook["mistakes"][number];

/** Where the notebook lives (its filters are query parameters on it) and where practice runs. */
type MistakesHrefs = { notebook: string; practice: string };

/** The notebook's filters and page, read from the query by the host. */
type MistakesFilters = {
  cause: MistakeCauseKey | null;
  nextOffset: number | null;
  status: "fixed" | "open";
};

function buildNotebookHref({
  cause,
  notebook,
  offset,
  status,
}: {
  cause: MistakeCauseKey | null;
  notebook: string;
  offset?: number;
  status: "fixed" | "open";
}) {
  const params = new URLSearchParams([
    ...(cause ? [["cause", cause]] : []),
    ...(status === "fixed" ? [["status", "fixed"]] : []),
    ...(offset ? [["offset", String(offset)]] : []),
  ]);

  const query = params.toString();
  return query ? `${notebook}?${query}` : notebook;
}

function groupBySkill(mistakes: readonly MistakeEntry[]) {
  return [...Map.groupBy(mistakes, (mistake) => mistake.skill?.id ?? "none").values()];
}

function CauseChips({
  active,
  counts,
  notebook,
}: {
  active: MistakeCauseKey | null;
  counts: Notebook["counts"];
  notebook: string;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const causeLabel = useCauseLabel();

  const chips = [
    { cause: null, count: counts.open, label: t("All") },
    ...MISTAKE_CAUSES.filter((cause) => counts.byCause[cause] > 0).map((cause) => ({
      cause,
      count: counts.byCause[cause],
      label: causeLabel(cause),
    })),
  ];

  return (
    <nav aria-label={t("Filter by cause")} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <LearnLink
          aria-current={chip.cause === active ? "page" : undefined}
          className={cn(
            buttonVariants({ size: "sm", variant: chip.cause === active ? "default" : "outline" }),
            "h-11",
          )}
          href={buildNotebookHref({ cause: chip.cause, notebook, status: "open" })}
          key={chip.cause ?? "all"}
          prefetch={false}
        >
          {chip.label}
          <span className="tabular-nums opacity-70">{format.number(chip.count)}</span>
        </LearnLink>
      ))}
    </nav>
  );
}

/**
 * The mistakes notebook: open mistakes grouped by skill, each with why it happened, and one
 * "Practice mistakes" button that drills them by cause. The same notebook in both modes.
 */
export function MistakesNotebook({
  filters,
  hrefs,
  notebook,
}: {
  filters: MistakesFilters;
  hrefs: MistakesHrefs;
  notebook: Notebook;
}) {
  const t = useExtracted();
  const { counts, mistakes } = notebook;
  const showingFixed = filters.status === "fixed";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-semibold tracking-tight">
          {t("Mistakes notebook")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(
            "{open, plural, =0 {Nothing to fix right now.} one {# to fix} other {# to fix}} · {fixed, plural, one {# fixed} other {# fixed}}",
            { fixed: counts.fixed, open: counts.open },
          )}
        </p>
      </header>

      {counts.open > 0 && (
        <LearnLink
          className={cn(
            buttonVariants({ size: "lg" }),
            "in-data-[mode=fun]:bg-fun-lime in-data-[mode=fun]:text-fun-lime-foreground self-start",
          )}
          href={hrefs.practice}
          // Practice picks a fresh set of mistakes when it opens, so it isn't prefetched.
          prefetch={false}
        >
          <PlayIcon aria-hidden="true" data-icon="inline-start" />
          {t("Practice mistakes")}
        </LearnLink>
      )}

      {counts.open > 0 && !showingFixed && (
        <CauseChips active={filters.cause} counts={counts} notebook={hrefs.notebook} />
      )}

      {mistakes.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {t(
            "No open mistakes here. Mistakes you make in lessons and reviews land in this notebook.",
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groupBySkill(mistakes).map((group) => (
            <section className="flex flex-col gap-2" key={group[0]?.skill?.id ?? "none"}>
              <SectionLabel>{group[0]?.skill?.name ?? t("Other questions")}</SectionLabel>
              <ul className="flex flex-col gap-2">
                {group.map((mistake) => (
                  <MistakeEntryCard
                    key={mistake.id}
                    mistake={mistake}
                    trueFalseLabels={notebook.trueFalseLabels}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.nextOffset !== null && (
          <LearnLink
            className={buttonVariants({ variant: "outline" })}
            href={buildNotebookHref({
              ...filters,
              notebook: hrefs.notebook,
              offset: filters.nextOffset,
            })}
            prefetch={false}
          >
            {t("Show more")}
          </LearnLink>
        )}
        {showingFixed ? (
          <LearnLink
            className={buttonVariants({ variant: "ghost" })}
            href={hrefs.notebook}
            prefetch={false}
          >
            {t("See open mistakes")}
          </LearnLink>
        ) : (
          counts.fixed > 0 && (
            <LearnLink
              className={buttonVariants({ variant: "ghost" })}
              href={buildNotebookHref({ cause: null, notebook: hrefs.notebook, status: "fixed" })}
              prefetch={false}
            >
              {t("See fixed mistakes")}
            </LearnLink>
          )
        )}
      </div>
    </div>
  );
}
