"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Meter } from "../_components/meter";
import { type CardSection, toCardSections } from "./card-sections";
import { type ContentGroup, useContentScreen } from "./content-context";
import { ChapterPageLink } from "./content-map-links";
import { FlipCard, getCardTone } from "./flip-card";

/** A group opens with its first cards; the rest wait behind "Show all" so rows stay light. */
const FIRST_CARDS = 12;
const PERCENT = 100;

/** Gold, active and fading as one thin bar, the way the group's memory looks at a glance. */
function GroupBar({ counts }: { counts: ContentGroup["counts"] }) {
  const total = Math.max(1, counts.total);

  const active =
    counts.learning + counts.solid - Math.min(counts.fading, counts.learning + counts.solid);

  const share = (count: number) => `${(count / total) * PERCENT}%`;

  return (
    <Meter className="flex w-full gap-0.5">
      <span className="bg-fun-gold h-full" style={{ width: share(counts.mastered) }} />
      <span className="bg-fun-accent-cyan h-full" style={{ width: share(active) }} />
      <span className="bg-fun-fg3 h-full" style={{ width: share(counts.fading) }} />
    </Meter>
  );
}

/** A small neat stack in the group's color. Never fanned like a hand of cards. */
function CardStack({ tone }: { tone: string }) {
  return (
    <span aria-hidden="true" className="relative block size-11 shrink-0">
      <span
        className={cn("fun-card absolute inset-x-1.5 top-0 bottom-2.5 rounded-lg opacity-50", tone)}
      />
      <span
        className={cn("fun-card absolute inset-x-0.5 top-1 bottom-1.5 rounded-lg opacity-75", tone)}
      />
      <span className={cn("fun-card absolute inset-x-0 top-2 bottom-0 rounded-lg", tone)} />
    </span>
  );
}

/**
 * "12 cards · 1 fading" for a chapter or a section. A chapter counts the cards on screen, so a
 * search says how many of its cards match.
 */
function useCardCounts() {
  const t = useExtracted();

  return ({ counts, shown }: { counts: ContentGroup["counts"]; shown: number }) =>
    [
      t("{count, plural, one {# card} other {# cards}}", { count: shown }),
      counts.fading > 0 && t("{fading, number} fading", { fading: counts.fading }),
    ]
      .filter(Boolean)
      .join(" · ");
}

/**
 * A chapter's cards behind its stack, counts and memory bar. A chapter that stands in for its
 * section (it has the section's title) takes the section's heading level and type.
 */
function CardGroup({
  defaultOpen,
  group,
  isSection,
  tone,
}: {
  defaultOpen: boolean;
  group: ContentGroup;
  isSection: boolean;
  tone: string;
}) {
  const t = useExtracted();
  const cardCounts = useCardCounts();
  const [open, setOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const firstRevealedRef = useRef<HTMLLIElement>(null);
  const cards = showAll ? group.cards : group.cards.slice(0, FIRST_CARDS);

  // "Show all" leaves once it's used, so focus goes on to the first card it revealed.
  useEffect(() => {
    if (showAll) {
      firstRevealedRef.current?.querySelector("button")?.focus();
    }
  }, [showAll]);

  const toggle = (
    <button
      aria-expanded={open}
      className="focus-visible:ring-fun-accent-lime flex min-h-14 w-full items-center gap-3 rounded-2xl text-left outline-none focus-visible:ring-2"
      onClick={() => setOpen((value) => !value)}
      type="button"
    >
      <CardStack tone={tone} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={isSection ? "font-fun-display text-lg font-bold" : "font-semibold"}>
          {group.title || t("Other skills")}
        </span>
        <span className="text-fun-fg2 text-xs">
          {cardCounts({ counts: group.counts, shown: group.cards.length })}
        </span>
        <GroupBar counts={group.counts} />
      </span>
      <ChevronDownIcon
        aria-hidden="true"
        className={cn(
          "text-fun-fg2 size-4 shrink-0 motion-safe:transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );

  return (
    <li className="fun-glass flex flex-col gap-3 rounded-3xl p-3" data-slot="card-group">
      {isSection ? <h2>{toggle}</h2> : toggle}

      {open && (
        <>
          <ChapterPageLink areaId={group.areaId} />
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cards.map((card, index) => (
              <li key={card.skillId} ref={index === FIRST_CARDS ? firstRevealedRef : undefined}>
                <FlipCard card={card} tone={tone} />
              </li>
            ))}
          </ul>
          {!showAll && group.cards.length > FIRST_CARDS && (
            <button
              className="text-fun-accent-lime focus-visible:ring-fun-accent-lime min-h-11 rounded-full text-sm font-semibold outline-none focus-visible:ring-2"
              onClick={() => setShowAll(true)}
              type="button"
            >
              {t("Show all {count, number}", { count: group.cards.length })}
            </button>
          )}
        </>
      )}
    </li>
  );
}

/**
 * A course or exam subject above its chapters: its name, with its card counts and memory bar when
 * it has several chapters (with one, that chapter's row shows the same).
 */
function SectionHeader({ section }: { section: CardSection }) {
  const t = useExtracted();
  const cardCounts = useCardCounts();
  const { counts } = section;

  const title = (
    <h2 className="font-fun-display min-w-0 text-lg font-bold">
      {section.title || t("Other skills")}
    </h2>
  );

  if (section.header !== "full") {
    return <div className="px-1">{title}</div>;
  }

  return (
    <div className="flex flex-col gap-1.5 px-1">
      <div className="flex items-baseline justify-between gap-2">
        {title}
        <span className="text-fun-fg2 shrink-0 text-xs">
          {cardCounts({ counts, shown: counts.total })}
        </span>
      </div>
      <GroupBar counts={counts} />
    </div>
  );
}

/**
 * Cards grouped by area (the course or exam subject) when the goal has several, then by chapter:
 * one row per chapter with its stack, counts and memory bar. Only open rows draw their cards,
 * which keeps a thousand cards fast; a search opens the rows with matches.
 */
export function FunCardGroups({
  groups,
  isFiltering,
}: {
  groups: ContentGroup[];
  isFiltering: boolean;
}) {
  const t = useExtracted();
  const { content } = useContentScreen();
  // Each chapter keeps its color while a search or filter hides others.
  const toneIndex = new Map(content.groups.map((group, index) => [group.areaId, index]));
  const sections = toCardSections({ all: content.groups, groups });

  if (groups.length === 0) {
    return <p className="text-fun-fg2 py-6 text-center text-sm">{t("No cards match.")}</p>;
  }

  const rows = (list: ContentGroup[], isSection = false) => (
    <ul className="flex flex-col gap-2">
      {list.map((group) => (
        <CardGroup
          defaultOpen={isFiltering || group.areaId === groups[0]?.areaId}
          group={group}
          isSection={isSection}
          key={`${group.areaId}:${isFiltering}`}
          tone={getCardTone(toneIndex.get(group.areaId) ?? 0)}
        />
      ))}
    </ul>
  );

  if (!sections) {
    return rows(groups);
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section className="flex flex-col gap-3" key={section.key}>
          {section.header !== "none" && <SectionHeader section={section} />}
          {rows(section.groups, section.header === "none")}
        </section>
      ))}
    </div>
  );
}
