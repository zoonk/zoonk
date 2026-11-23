"use client";

import { type CurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { type NoticedPattern } from "@zoonk/core/view-models/language/contract";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { buttonVariants } from "@zoonk/ui/components/button";
import { FoldChevron } from "@zoonk/ui/components/collapsible";
import { DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import {
  DETAIL_PRIMARY_CLASS,
  DetailAside,
  DetailContent,
  DetailLayout,
} from "../_components/detail-page";
import { EnterLink } from "../_components/enter-button";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListGroup,
  ListRowBody,
  ListRowContent,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PageSubtitle } from "../_components/page";
import { PageTab, PageTabs, PageTabsGroup } from "../_components/page-tabs";
import { PatternRow } from "../language/today/language-today-section";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { LearnPageBar } from "../shell/learn-bar";
import { MistakeEntryCard, getMistakeEntryLinks } from "./mistake-entry";
import { useNotebookAvailabilityText } from "./notebook-availability-text";
import { useMistakesInbox } from "./use-mistakes-inbox";

type Notebook = Extract<CurrentUserMistakes, { status: "ready" }>;
export type MistakeEntry = Notebook["mistakes"][number];

type MistakesHrefs = { lesson: string; notebook: string; pattern: string; practice: string };

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

function NotebookHero({ notebook }: { notebook: Notebook }) {
  const t = useExtracted();
  const availability = useNotebookAvailabilityText(notebook.availability);

  return (
    <DetailHero>
      <DetailHeroText>
        <DetailTitle>{t("Mistakes notebook")}</DetailTitle>
        {availability && <PageSubtitle>{availability}</PageSubtitle>}
      </DetailHeroText>
    </DetailHero>
  );
}

function PracticeBar({ hrefs, notebook }: { hrefs: MistakesHrefs; notebook: Notebook }) {
  const t = useExtracted();

  if (notebook.availability.ready === 0) {
    return null;
  }

  return (
    <BottomBar>
      <BottomBarActions>
        <EnterLink
          className={DETAIL_PRIMARY_CLASS}
          href={hrefs.practice}
          // Practice picks a fresh set of mistakes when it opens, so it isn't prefetched.
          prefetch={false}
          size="lg"
        >
          {t({
            description: "Opens practice on the mistakes that are ready to fix.",
            id: "practiceMistakesAction",
            message: "Practice mistakes",
          })}
        </EnterLink>
      </BottomBarActions>
    </BottomBar>
  );
}

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
    <PageTabs data-slot="mistakes-tabs" label={t("Mistakes")}>
      {tabs.map((tab) => (
        <PageTab
          count={tab.count}
          current={tab.current}
          href={buildNotebookHref({ notebook: notebookHref, status: tab.status })}
          key={tab.status}
        >
          {tab.label}
        </PageTab>
      ))}
    </PageTabs>
  );
}

function MistakesInbox({
  groups,
  hrefs,
  openLesson,
  tomorrowOnPage,
  trueFalseLabels,
}: {
  groups: MistakeEntry[][];
  hrefs: MistakesHrefs;
  openLesson: (mistakeId: string) => Promise<boolean>;
  tomorrowOnPage: boolean;
  trueFalseLabels: Notebook["trueFalseLabels"];
}) {
  const t = useExtracted();
  const keys = groups.map((group) => getGroupKey(group));
  const { isInbox, isShown, select } = useMistakesInbox(keys);
  const rowsStyle: CSSPropertiesWithVariables = { "--skills": groups.length };

  return (
    <div
      className="flex flex-col lg:grid lg:grid-cols-[minmax(20rem,1fr)_minmax(0,calc(var(--container-column)+2rem+1px))] lg:grid-rows-[repeat(var(--skills),auto)_1fr] lg:items-start lg:gap-x-8 lg:*:data-shown:border-t-transparent lg:[&>[data-shown]+section+button]:border-t-transparent [&>button+button]:border-t [&>section+button]:border-t"
      data-slot="mistakes-inbox"
      style={rowsStyle}
    >
      {groups.map((group) => {
        const key = getGroupKey(group);
        const open = isShown(key);
        const name = group[0]?.skill?.name ?? t("Other questions");
        const panelId = `mistakes-skill-${key}`;

        return (
          <Fragment key={key}>
            <button
              aria-controls={panelId}
              // Beside its mistakes a skill is picked, and pressing it again changes nothing: only
              // a fold says it opens and closes.
              aria-current={isInbox && open ? "true" : undefined}
              aria-expanded={isInbox ? undefined : open}
              data-shown={open || undefined}
              className={cn(
                LIST_ROW_INTERACTIVE_CLASS,
                "group/skill lg:col-start-1",
                open && "lg:before:bg-muted",
              )}
              onClick={() => select(key)}
              type="button"
            >
              <ListRowBody>
                <ListRowContent>
                  <ListRowTitle>{name}</ListRowTitle>
                </ListRowContent>
                <ListRowTrailing>{group.length}</ListRowTrailing>
              </ListRowBody>
              <FoldChevron className="lg:hidden" />
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
                    openLesson={openLesson}
                    tomorrowOnPage={tomorrowOnPage}
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
    <p className="text-muted-foreground text-sm" data-slot="mistakes-empty">
      {showingFixed
        ? t("Mistakes you fix in practice show up here.")
        : t("Nothing to fix right now. Mistakes from your lessons and reviews show up here.")}
    </p>
  );
}

export function MistakesNotebookBar() {
  const t = useExtracted();
  const { today } = useLearnRoutes();

  return (
    <LearnPageBar back={{ href: today }} listed="learner" root title={t("Mistakes notebook")} />
  );
}

export function MistakesNotebook({
  filters,
  hrefs,
  notebook,
  openLesson,
  pattern,
}: {
  filters: MistakesFilters;
  hrefs: MistakesHrefs;
  notebook: Notebook;
  openLesson: (mistakeId: string) => Promise<boolean>;
  pattern: NoticedPattern | null;
}) {
  const t = useExtracted();
  const { counts, mistakes } = notebook;
  const showingFixed = filters.status === "fixed";
  const groups = groupBySkill(mistakes);

  return (
    <DetailLayout
      bar={<MistakesNotebookBar />}
      bottomBar={<PracticeBar hrefs={hrefs} notebook={notebook} />}
      data-slot="mistakes-notebook"
    >
      <DetailAside>
        <NotebookHero notebook={notebook} />
      </DetailAside>

      <PageTabsGroup>
        <NotebookTabs counts={counts} notebookHref={hrefs.notebook} showingFixed={showingFixed} />

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
                openLesson={openLesson}
                tomorrowOnPage={notebook.availability.ready === 0}
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
      </PageTabsGroup>
    </DetailLayout>
  );
}
