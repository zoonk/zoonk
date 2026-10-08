"use client";

import { type CurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon, CircleCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  DETAIL_PRIMARY_CLASS,
  DetailActions,
  DetailAside,
  DetailContent,
  DetailEyebrow,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailLayout,
  DetailPrimaryLabel,
  DetailTitle,
} from "../_components/detail-page";
import { KindTile } from "../_components/kind-tile";
import {
  LIST_GROUP_CLASS,
  LIST_ROW_INTERACTIVE_CLASS,
  ListGroup,
  ListRowContent,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { PatternRow } from "../language/today/language-today-section";
import { LearnLink } from "../learn-link";
import { LearnPageBar } from "../shell/learn-bar";
import { MistakeEntryCard } from "./mistake-entry";

type Notebook = Extract<CurrentUserMistakes, { status: "ready" }>;
export type MistakeEntry = Notebook["mistakes"][number];

/**
 * Where the notebook lives (its pages are query parameters on it), back to Today, where
 * practice runs and a noticed pattern's page (the pattern id is appended).
 */
type MistakesHrefs = { back: string; notebook: string; pattern: string; practice: string };

/** The notebook's page, read from the query by the host. */
type MistakesFilters = { nextOffset: number | null; status: "fixed" | "open" };

/** A language goal's pattern noticed in recent mistakes, not practiced yet. */
type NoticedPattern = NonNullable<LanguageTodayView["pattern"]>;

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

/**
 * The notebook at a glance: its tile, how many mistakes are left to fix in big type (or how many
 * were fixed, on that page), and under it the one thing to do about them.
 */
function NotebookHero({
  hrefs,
  notebook,
  showingFixed,
}: {
  hrefs: MistakesHrefs;
  notebook: Notebook;
  showingFixed: boolean;
}) {
  const t = useExtracted();
  const { counts } = notebook;

  return (
    <>
      <DetailHero>
        <KindTile kind="mistakes" size="lg" />
        <DetailHeroText>
          <DetailEyebrow>{t("Mistakes notebook")}</DetailEyebrow>
          <DetailTitle className="tabular-nums">
            {showingFixed
              ? t("{fixed, plural, one {# fixed} other {# fixed}}", { fixed: counts.fixed })
              : t("{open, plural, =0 {Nothing to fix right now} one {# to fix} other {# to fix}}", {
                  open: counts.open,
                })}
          </DetailTitle>
          {!showingFixed && counts.open === 0 && (
            <DetailFacts>
              {t("Mistakes from your lessons and reviews show up here, ready to practice.")}
            </DetailFacts>
          )}
          {!showingFixed && counts.open > 0 && counts.fixed > 0 && (
            <DetailFacts className="tabular-nums">
              {t("{fixed, plural, one {# fixed} other {# fixed}}", { fixed: counts.fixed })}
            </DetailFacts>
          )}
        </DetailHeroText>
      </DetailHero>

      {!showingFixed && counts.open > 0 && (
        <DetailActions>
          <LearnLink
            className={DETAIL_PRIMARY_CLASS}
            href={hrefs.practice}
            // Practice picks a fresh set of mistakes when it opens, so it isn't prefetched.
            prefetch={false}
          >
            <DetailPrimaryLabel label={t("Practice mistakes")} />
          </LearnLink>
        </DetailActions>
      )}
    </>
  );
}

/** "See fixed mistakes" as a row with how many, opening the notebook's fixed ones. */
function FixedMistakesRow({ count, notebookHref }: { count: number; notebookHref: string }) {
  const t = useExtracted();

  return (
    <ListGroup>
      <ListRowLink
        href={buildNotebookHref({ notebook: notebookHref, status: "fixed" })}
        prefetch={false}
      >
        <ListRowLeading>
          <ListRowIcon className="text-success">
            <CircleCheckIcon />
          </ListRowIcon>
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("See fixed mistakes")}</ListRowTitle>
        </ListRowContent>
        <ListRowTrailing>{count}</ListRowTrailing>
      </ListRowLink>
    </ListGroup>
  );
}

/**
 * One skill's mistakes behind one row: its name and how many, opening in place to each question,
 * the learner's answer, the right one and why. A notebook with a single skill opens it.
 */
function SkillGroup({
  group,
  open,
  trueFalseLabels,
}: {
  group: MistakeEntry[];
  open: boolean;
  trueFalseLabels: Notebook["trueFalseLabels"];
}) {
  const t = useExtracted();
  const [first] = group;

  return (
    <li>
      <details className="group" open={open}>
        <summary
          className={cn(
            LIST_ROW_INTERACTIVE_CLASS,
            "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          )}
        >
          <ListRowContent>
            <ListRowTitle>{first?.skill?.name ?? t("Other questions")}</ListRowTitle>
          </ListRowContent>
          <ListRowTrailing>{group.length}</ListRowTrailing>
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>

        <ul className="flex flex-col px-4 pb-2">
          {group.map((mistake) => (
            <MistakeEntryCard
              key={mistake.id}
              mistake={mistake}
              trueFalseLabels={trueFalseLabels}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

/**
 * The mistakes notebook: how many are left to fix and one "Practice mistakes" button that drills
 * them by cause; the mistakes themselves wait behind one row per skill. For a language goal, the
 * pattern noticed in them is one tap away.
 */
export function MistakesNotebook({
  filters,
  hrefs,
  notebook,
  pattern,
}: {
  filters: MistakesFilters;
  hrefs: MistakesHrefs;
  notebook: Notebook;
  pattern: NoticedPattern | null;
}) {
  const t = useExtracted();
  const { counts, mistakes } = notebook;
  const showingFixed = filters.status === "fixed";
  const groups = groupBySkill(mistakes);

  return (
    <div className="flex flex-col gap-8">
      <LearnPageBar
        back={
          showingFixed
            ? { href: hrefs.notebook, label: t("Mistakes notebook") }
            : { href: hrefs.back, label: t("Today") }
        }
        title={t("Mistakes notebook")}
      />

      <DetailLayout>
        <DetailAside>
          <NotebookHero hrefs={hrefs} notebook={notebook} showingFixed={showingFixed} />
        </DetailAside>

        <DetailContent>
          {pattern && !showingFixed && (
            <ListGroup>
              <PatternRow href={`${hrefs.pattern}/${pattern.id}`} pattern={pattern} />
            </ListGroup>
          )}

          {groups.length > 0 && (
            <PageSection aria-labelledby="mistakes-list-title">
              <PageSectionHeader>
                <PageSectionTitle id="mistakes-list-title">
                  {showingFixed ? t("What you fixed") : t("What you got wrong")}
                </PageSectionTitle>
              </PageSectionHeader>

              <ul className={LIST_GROUP_CLASS}>
                {groups.map((group) => (
                  <SkillGroup
                    group={group}
                    key={group[0]?.skill?.id ?? "none"}
                    open={groups.length === 1}
                    trueFalseLabels={notebook.trueFalseLabels}
                  />
                ))}
              </ul>
            </PageSection>
          )}

          {!showingFixed && counts.fixed > 0 && (
            <FixedMistakesRow count={counts.fixed} notebookHref={hrefs.notebook} />
          )}

          <div className="flex flex-wrap gap-2 empty:hidden">
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
          </div>
        </DetailContent>
      </DetailLayout>
    </div>
  );
}
