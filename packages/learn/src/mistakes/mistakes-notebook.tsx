"use client";

import { type CurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { type NoticedPattern } from "@zoonk/core/view-models/language/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Fragment, useState } from "react";
import {
  DETAIL_PRIMARY_CLASS,
  DetailActions,
  DetailAside,
  DetailContent,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailLayout,
  DetailTitle,
} from "../_components/detail-page";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListGroup,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { INBOX_PAGE_CLASS, PageEyebrow } from "../_components/page";
import { DoneMark } from "../_components/status-mark";
import { PatternRow } from "../language/today/language-today-section";
import { LearnLink } from "../learn-link";
import { LearnPageBar } from "../shell/learn-bar";
import { MistakeEntryCard, getMistakeEntryLinks } from "./mistake-entry";
import { NotebookAvailabilityText } from "./notebook-availability-text";

type Notebook = Extract<CurrentUserMistakes, { status: "ready" }>;
export type MistakeEntry = Notebook["mistakes"][number];

type MistakesHrefs = {
  back: string;
  lesson: string;
  notebook: string;
  pattern: string;
  practice: string;
};

type MistakesFilters = { nextOffset: number | null; status: "fixed" | "open" };

function buildNotebookHref({
  notebook,
  offset,
  status,
}: {
  notebook: string;
  offset?: number;
  status: "fixed" | "open";
}) {
  const params = new URLSearchParams([
    ...(status === "fixed" ? [["status", "fixed"]] : []),
    ...(offset ? [["offset", String(offset)]] : []),
  ]);

  const query = params.toString();
  return query ? `${notebook}?${query}` : notebook;
}

function groupBySkill(mistakes: readonly MistakeEntry[]) {
  return [...Map.groupBy(mistakes, (mistake) => mistake.skill?.id ?? "none").values()];
}

function getGroupKey(group: readonly MistakeEntry[]): string {
  return group[0]?.skill?.id ?? "none";
}

/** Tailwind's `lg`. */
const INBOX_QUERY = "(min-width: 64rem)";

function NotebookHero({
  goalTitle,
  hrefs,
  notebook,
}: {
  goalTitle: string | null;
  hrefs: MistakesHrefs;
  notebook: Notebook;
}) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLAnchorElement>({ enabled: notebook.availability.ready > 0 });
  const { availability, counts } = notebook;

  return (
    <DetailHero>
      <DetailHeroText>
        {goalTitle && <PageEyebrow>{goalTitle}</PageEyebrow>}
        <DetailTitle>{t("Mistakes notebook")}</DetailTitle>
        <DetailFacts>
          <NotebookAvailabilityText availability={availability} fixed={counts.fixed} />
        </DetailFacts>
        {availability.ready === 0 && availability.tomorrow > 0 && (
          <p className="text-muted-foreground text-sm text-pretty">
            {t("Mistakes come back for practice from the day after you make them.")}
          </p>
        )}
      </DetailHeroText>

      {availability.ready > 0 && (
        <DetailActions>
          <LearnLink
            className={DETAIL_PRIMARY_CLASS}
            href={hrefs.practice}
            // Practice picks a fresh set of mistakes when it opens, so it isn't prefetched.
            prefetch={false}
            ref={ref}
          >
            {t("Practice mistakes")}
            <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
          </LearnLink>
        </DetailActions>
      )}
    </DetailHero>
  );
}

const TAB_CLASS =
  "focus-visible:ring-ring/50 hit-area relative flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] font-medium outline-none transition-colors focus-visible:ring-[3px] aria-[current=page]:bg-muted aria-[current=page]:text-foreground text-muted-foreground hover:text-foreground hover:bg-muted/70";

function NotebookTabs({
  counts,
  notebookHref,
  showingFixed,
}: {
  counts: Notebook["counts"];
  notebookHref: string;
  showingFixed: boolean;
}) {
  const t = useExtracted();

  const tabs = [
    { count: counts.open, current: !showingFixed, label: t("To fix"), status: "open" as const },
    { count: counts.fixed, current: showingFixed, label: t("Fixed"), status: "fixed" as const },
  ];

  return (
    <nav aria-label={t("Mistakes")} data-slot="mistakes-tabs">
      <ul className="flex items-center gap-1">
        {tabs.map((tab) => (
          <li key={tab.status}>
            <LearnLink
              aria-current={tab.current ? "page" : undefined}
              className={TAB_CLASS}
              href={buildNotebookHref({ notebook: notebookHref, status: tab.status })}
            >
              {tab.label}
              <span className="font-mono text-xs tabular-nums">{tab.count}</span>
            </LearnLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MistakesInbox({
  groups,
  hrefs,
  trueFalseLabels,
}: {
  groups: MistakeEntry[][];
  hrefs: MistakesHrefs;
  trueFalseLabels: Notebook["trueFalseLabels"];
}) {
  const t = useExtracted();
  const keys = groups.map((group) => getGroupKey(group));
  const [picked, setPicked] = useState<string | null>(keys[0] ?? null);

  const selected = picked === null || keys.includes(picked) ? picked : (keys[0] ?? null);

  const rowsStyle: CSSPropertiesWithVariables = { "--skills": groups.length };

  const select = (key: string) =>
    setPicked(selected === key && !globalThis.matchMedia(INBOX_QUERY).matches ? null : key);

  return (
    <div
      className="flex flex-col lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[repeat(var(--skills),auto)_1fr] lg:items-start lg:gap-x-8 lg:*:aria-expanded:border-t-transparent lg:[&>[aria-expanded=true]+section+button]:border-t-transparent [&>button+button]:border-t [&>section+button]:border-t"
      data-slot="mistakes-inbox"
      style={rowsStyle}
    >
      {groups.map((group) => {
        const key = getGroupKey(group);
        const open = selected === key;
        const name = group[0]?.skill?.name ?? t("Other questions");
        const panelId = `mistakes-skill-${key}`;

        return (
          <Fragment key={key}>
            <button
              aria-controls={panelId}
              aria-expanded={open}
              className={cn(
                LIST_ROW_INTERACTIVE_CLASS,
                "group/skill lg:col-start-1",
                open && "lg:before:bg-muted",
              )}
              onClick={() => select(key)}
              type="button"
            >
              <ListRowLeading>{group[0]?.status === "fixed" && <DoneMark />}</ListRowLeading>
              <ListRowContent>
                <ListRowTitle>{name}</ListRowTitle>
              </ListRowContent>
              <ListRowTrailing>{group.length}</ListRowTrailing>
              <ChevronDownIcon
                aria-hidden="true"
                className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-aria-expanded/skill:rotate-180 motion-reduce:transition-none lg:hidden"
              />
            </button>

            <section
              aria-label={name}
              className="pb-2 lg:col-start-2 lg:row-span-full lg:min-h-full lg:border-l lg:pb-0 lg:pl-8"
              hidden={!open}
              id={panelId}
            >
              <ul className="flex flex-col">
                {group.map((mistake, index) => (
                  <MistakeEntryCard
                    continued={
                      mistake.snapshot.set !== null &&
                      mistake.snapshot.set !== undefined &&
                      group[index - 1]?.snapshot.set?.id === mistake.snapshot.set.id
                    }
                    key={mistake.id}
                    links={getMistakeEntryLinks({ hrefs, mistake })}
                    mistake={mistake}
                    trueFalseLabels={trueFalseLabels}
                  />
                ))}
              </ul>
            </section>
          </Fragment>
        );
      })}
    </div>
  );
}

function EmptyNotebook({ showingFixed }: { showingFixed: boolean }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-sm text-pretty" data-slot="mistakes-empty">
      {showingFixed
        ? t("Mistakes you fix in practice show up here.")
        : t("Nothing to fix right now. Mistakes from your lessons and reviews show up here.")}
    </p>
  );
}

export function MistakesNotebook({
  filters,
  goalTitle = null,
  hrefs,
  notebook,
  pattern,
}: {
  filters: MistakesFilters;
  goalTitle?: string | null;
  hrefs: MistakesHrefs;
  notebook: Notebook;
  pattern: NoticedPattern | null;
}) {
  const t = useExtracted();
  const { counts, mistakes } = notebook;
  const showingFixed = filters.status === "fixed";
  const groups = groupBySkill(mistakes);

  return (
    <DetailLayout
      bar={<LearnPageBar back={{ href: hrefs.back }} root title={t("Mistakes notebook")} />}
      className={INBOX_PAGE_CLASS}
      data-slot="mistakes-notebook"
    >
      <DetailAside>
        <NotebookHero goalTitle={goalTitle} hrefs={hrefs} notebook={notebook} />
        <NotebookTabs counts={counts} notebookHref={hrefs.notebook} showingFixed={showingFixed} />
      </DetailAside>

      <DetailContent>
        {pattern && !showingFixed && (
          <ListGroup>
            <PatternRow href={`${hrefs.pattern}/${pattern.id}`} pattern={pattern} />
          </ListGroup>
        )}

        {groups.length > 0 ? (
          <section aria-label={showingFixed ? t("What you fixed") : t("What you got wrong")}>
            <MistakesInbox
              groups={groups}
              hrefs={hrefs}
              trueFalseLabels={notebook.trueFalseLabels}
            />
          </section>
        ) : (
          <EmptyNotebook showingFixed={showingFixed} />
        )}

        {filters.nextOffset !== null && (
          <LearnLink
            className={buttonVariants({ className: "self-start", variant: "outline" })}
            href={buildNotebookHref({
              ...filters,
              notebook: hrefs.notebook,
              offset: filters.nextOffset,
            })}
          >
            {t("Show more")}
          </LearnLink>
        )}
      </DetailContent>
    </DetailLayout>
  );
}
