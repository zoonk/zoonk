"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  DetailActions,
  DetailHero,
  DetailHeroText,
  DetailTitle,
} from "@zoonk/ui/components/detail";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useId } from "react";
import {
  DETAIL_PRIMARY_CLASS,
  DetailAside,
  DetailContent,
  DetailLayout,
} from "../_components/detail-page";
import { FreeWeekOverNotice } from "../_components/free-week-over";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import { PageEyebrow, PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { PageTab, PageTabs } from "../_components/page-tabs";
import { LearnLink } from "../learn-link";
import { LearnPageBar } from "../shell/learn-bar";
import {
  MIND_MAP_TABS,
  type MindMapTab,
  buildMindMapsHref,
  buildStudyHref,
} from "./_utils/mind-map-urls";
import {
  type MindMapsPage,
  countTabs,
  groupBySubject,
  splitChapters,
} from "./_utils/mind-maps-page";
import { type MindMapLibraryActions } from "./mind-map-actions";
import { MindMapIndex } from "./mind-map-index";
import {
  ChapterMapRow,
  LessonGroupRow,
  type LessonGroupRowData,
  SavedMapRow,
  UnavailableMapRow,
} from "./mind-map-index-rows";
import { useMindMapPlace } from "./mind-map-resume";
import { NotMadeYet } from "./not-made-yet";
import { type MindMapsLibrary, useMindMapsLibrary } from "./use-mind-maps-library";

export type { MindMapLimit } from "../_components/help-limit-notice";
export type {
  MindMapActions,
  MindMapLibraryActions,
  MindMapRequestOutcome,
} from "./mind-map-actions";

export type MindMapsHrefs = { back: string; page: string; study: string };

type TabProps = { hrefs: MindMapsHrefs; library: MindMapsLibrary };

type IndexTabProps = TabProps & { subject: string | null };

function EmptyTab({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-muted-foreground max-w-prose text-sm text-pretty"
      data-slot="mind-maps-empty"
    >
      {children}
    </p>
  );
}

function StudyLabel() {
  const t = useExtracted();

  return t({
    description: "A button: study the mind maps, one by one. A verb, not the noun.",
    id: "mindMapsStudyAction",
    message: "Study",
  });
}

function StudyLink({ goalId, study, view }: { goalId: string; study: string; view: MindMapTab }) {
  const place = useMindMapPlace({ goalId, view });
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={DETAIL_PRIMARY_CLASS}
      href={buildStudyHref({ place, study, view })}
      // Where the learner stopped is only known once the page hydrates, so the deck loads on intent.
      prefetch="intent"
      ref={ref}
    >
      <StudyLabel />
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

function ChaptersTab({ hrefs, library, subject, tier }: IndexTabProps & { tier: EntitlementTier }) {
  const t = useExtracted();
  const { index, notMade } = splitChapters(library.page.chapters);

  const groups = groupBySubject(index).map((group) => ({
    ...group,
    rows: group.rows.map((chapter) => ({
      key: chapter.chapterId,
      node: <ChapterMapRow chapter={chapter} study={hrefs.study} />,
    })),
  }));

  return (
    <>
      {index.some((chapter) => chapter.status === "plusRequired") && (
        <FreeWeekOverNotice className="max-w-prose" />
      )}

      {index.length > 0 ? (
        <MindMapIndex groups={groups} label={t("Chapter maps")} opensAt={subject} />
      ) : (
        <EmptyTab>{t("No chapter maps yet. Every chapter you finish gets one.")}</EmptyTab>
      )}

      {notMade.length > 0 && <NotMadeYet chapters={notMade} library={library} tier={tier} />}
    </>
  );
}

function LessonsTab({ hrefs, library, subject }: IndexTabProps) {
  const t = useExtracted();
  const { chapters, lessonGroups } = library.page;

  const rows = lessonGroups.flatMap((group): LessonGroupRowData[] => {
    const chapter = chapters.find((candidate) => candidate.chapterId === group.chapterId);
    return chapter ? [{ ...group, ...chapter }] : [];
  });

  if (rows.length === 0) {
    return (
      <EmptyTab>
        {t("No lesson maps yet. Every lesson ends with one.")}
      </EmptyTab>
    );
  }

  const groups = groupBySubject(rows).map((group) => ({
    ...group,
    rows: group.rows.map((row) => ({
      key: row.chapterId,
      node: <LessonGroupRow group={row} study={hrefs.study} />,
    })),
  }));

  return (
    <>
      {rows.some((row) => row.locked > 0) && <FreeWeekOverNotice className="max-w-prose" />}
      <MindMapIndex groups={groups} label={t("Lesson maps by chapter")} opensAt={subject} />
    </>
  );
}

function SavedTab({ hrefs, library }: TabProps) {
  const t = useExtracted();
  const unavailableId = useId();
  const { chapters, saved } = library.page;

  const shown = saved.filter((entry) => library.saves.isSaved({ saved: true, target: entry }));

  const open = shown.filter((entry) => entry.available);
  const gone = shown.filter((entry) => !entry.available);

  const remove = (entry: (typeof saved)[number]) =>
    library.saves.toggle({ saved: true, target: entry });

  if (shown.length === 0) {
    return (
      <EmptyTab>{t("Nothing saved yet. Tap the bookmark on a map to keep it here.")}</EmptyTab>
    );
  }

  return (
    <>
      {open.length > 0 && (
        <ul aria-label={t("Saved maps")} className={LIST_GROUP_CLASS}>
          {open.map((entry) => (
            <li key={`${entry.kind}:${entry.targetId}`}>
              <SavedMapRow
                onRemove={() => remove(entry)}
                saved={{
                  ...entry,
                  thumbnailUrl:
                    chapters.find((chapter) => chapter.chapterId === entry.chapterId)
                      ?.thumbnailUrl ?? null,
                }}
                study={hrefs.study}
              />
            </li>
          ))}
        </ul>
      )}

      {gone.length > 0 && (
        <PageSection aria-labelledby={unavailableId}>
          <PageSectionHeader>
            <PageSectionTitle id={unavailableId}>{t("No longer available")}</PageSectionTitle>
          </PageSectionHeader>
          <ul className={LIST_GROUP_CLASS}>
            {gone.map((entry) => (
              <li key={`${entry.kind}:${entry.targetId}`}>
                <UnavailableMapRow onRemove={() => remove(entry)} saved={entry} />
              </li>
            ))}
          </ul>
        </PageSection>
      )}
    </>
  );
}

function useTabLabels(): Record<MindMapTab, string> {
  const t = useExtracted();

  return {
    chapters: t("Chapters"),
    lessons: t("Lessons"),
    saved: t({
      description: "A tab's name: the list of mind maps the learner saved.",
      id: "mindMapsSavedTab",
      message: "Saved",
    }),
  };
}

/**
 * Tabs switch on the page: a copy of the page from the server, such as one a link prefetched, can
 * predate the learner's taps and undo them.
 */
function showTab(tab: MindMapTab) {
  globalThis.history.pushState(null, "", buildMindMapsHref({ page: "", tab }));
}

/** How many maps a tab's deck holds: a saved map that can no longer open isn't in it. */
function countDeck({ page, tab }: { page: MindMapsPage; tab: MindMapTab }): number {
  return tab === "saved"
    ? page.saved.filter((entry) => entry.available).length
    : countTabs(page)[tab];
}

export function MindMapsScreen({
  actions,
  hrefs,
  mindMaps,
  subject,
  tab,
  tier,
}: {
  actions: MindMapLibraryActions;
  hrefs: MindMapsHrefs;
  mindMaps: MindMapsPage;
  /** The subject the page was opened from, whose maps start unfolded. */
  subject: string | null;
  /**
   * The tab in the page's address, which a tab switch changes in place. Null opens the tab the
   * server picks: the first one with maps to show.
   */
  tab: MindMapTab | null;
  tier: EntitlementTier;
}) {
  const t = useExtracted();
  const labels = useTabLabels();
  const library = useMindMapsLibrary({ actions, served: mindMaps });
  const { page } = library;
  const current = tab ?? page.firstTab;
  const counts = countTabs(page);

  return (
    <DetailLayout
      bar={<LearnPageBar back={{ href: hrefs.back }} root title={t("Mind maps")} />}
      data-slot="mind-maps"
    >
      <DetailAside>
        <DetailHero>
          <DetailHeroText>
            <PageEyebrow>{page.goal.displayName}</PageEyebrow>
            <DetailTitle>{t("Mind maps")}</DetailTitle>
          </DetailHeroText>

          <DetailActions>
            {countDeck({ page, tab: current }) > 0 && (
              <StudyLink goalId={page.goal.id} study={hrefs.study} view={current} />
            )}
          </DetailActions>
        </DetailHero>

        <PageTabs data-slot="mind-maps-tabs" label={t("Mind maps")}>
          {MIND_MAP_TABS.map((name) => (
            <PageTab
              count={counts[name]}
              current={name === current}
              href={buildMindMapsHref({ page: hrefs.page, tab: name })}
              key={name}
              onSelect={() => showTab(name)}
            >
              {labels[name]}
            </PageTab>
          ))}
        </PageTabs>
      </DetailAside>

      <DetailContent>
        {current === "chapters" && (
          <ChaptersTab hrefs={hrefs} library={library} subject={subject} tier={tier} />
        )}
        {current === "lessons" && <LessonsTab hrefs={hrefs} library={library} subject={subject} />}
        {current === "saved" && <SavedTab hrefs={hrefs} library={library} />}
      </DetailContent>
    </DetailLayout>
  );
}
