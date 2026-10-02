"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type CardSection, toCardSections } from "./card-sections";
import { type ContentCard, type ContentGroup, useContentScreen } from "./content-context";
import { ChapterPageLink } from "./content-map-links";
import { useStateLabel } from "./use-state-label";

const STATE_DOT: Record<ContentCard["state"], string> = {
  learning: "bg-info",
  mastered: "bg-success",
  new: "bg-muted-foreground/40",
  solid: "bg-foreground",
};

function SkillRow({ card }: { card: ContentCard }) {
  const t = useExtracted();
  const stateLabel = useStateLabel();

  return (
    <li className="flex min-h-11 items-start gap-3 py-2" data-state={card.state}>
      <span
        aria-hidden="true"
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", STATE_DOT[card.state])}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm">{card.name}</span>
        {card.description && (
          <span className="text-muted-foreground text-xs">{card.description}</span>
        )}
      </div>
      {/* On the name's line height, so the state sits beside the name's first line. */}
      <span className="text-muted-foreground flex shrink-0 flex-col items-end text-xs leading-5">
        {stateLabel(card)}
        {card.fading && <span className="text-warning">{t("Fading")}</span>}
      </span>
    </li>
  );
}

/**
 * "12 skills · 3 mastered · 1 fading" for a chapter or a section. A chapter counts the skills on
 * screen, so a search says how many of its skills match.
 */
function useSkillCounts() {
  const t = useExtracted();

  return ({ counts, shown }: { counts: ContentGroup["counts"]; shown: number }) =>
    [
      t("{count, plural, one {# skill} other {# skills}}", { count: shown }),
      t("{mastered, number} mastered", { mastered: counts.mastered }),
      counts.fading > 0 && t("{fading, number} fading", { fading: counts.fading }),
    ]
      .filter(Boolean)
      .join(" · ");
}

/**
 * A chapter's skills behind its title and counts. A chapter that stands in for its section (it has
 * the section's title) takes the section's heading level and size.
 */
function SkillGroup({
  defaultOpen,
  group,
  isSection = false,
}: {
  defaultOpen: boolean;
  group: ContentGroup;
  isSection?: boolean;
}) {
  const t = useExtracted();
  const skillCounts = useSkillCounts();

  const trigger = (
    <CollapsibleTrigger className="group/skills focus-visible:ring-ring/50 flex w-full items-start gap-3 rounded-xl py-2.5 text-left outline-none focus-visible:ring-[3px]">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={isSection ? "text-base font-semibold" : "text-sm font-medium"}>
          {group.title || t("Other skills")}
        </span>
        <span className="text-muted-foreground text-xs">
          {skillCounts({ counts: group.counts, shown: group.cards.length })}
        </span>
      </span>
      {/* Sized to the title's first line, so the chevron stays beside it when the title wraps. */}
      <span
        aria-hidden="true"
        className={cn("flex h-lh flex-none items-center", !isSection && "text-sm")}
      >
        <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-data-panel-open/skills:rotate-180 motion-reduce:transition-none" />
      </span>
    </CollapsibleTrigger>
  );

  return (
    <Collapsible className="border-b last:border-b-0" defaultOpen={defaultOpen}>
      {isSection ? <h2>{trigger}</h2> : trigger}
      <CollapsibleContent>
        <ChapterPageLink areaId={group.areaId} />
        <ul className="flex flex-col pb-2 pl-1">
          {group.cards.map((card) => (
            <SkillRow card={card} key={card.skillId} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A course or exam subject above its chapters, with its skill counts when it has several. */
function SectionHeader({ section }: { section: CardSection }) {
  const t = useExtracted();
  const skillCounts = useSkillCounts();
  const { counts } = section;

  return (
    <div className="flex flex-col gap-0.5 pt-2">
      <h2 className="text-base font-semibold">{section.title || t("Other skills")}</h2>
      {section.header === "full" && (
        <p className="text-muted-foreground text-xs">
          {skillCounts({ counts, shown: counts.total })}
        </p>
      )}
    </div>
  );
}

/**
 * Focus's skill list: every skill of the goal with its state, grouped by area (the course or exam
 * subject) when the goal has several, then by chapter. Chapters start closed so a thousand skills
 * stay calm; a search or filter opens the chapters with matches.
 */
export function FocusSkillGroups({
  groups,
  isFiltering,
}: {
  groups: ContentGroup[];
  isFiltering: boolean;
}) {
  const t = useExtracted();
  const { content } = useContentScreen();
  const sections = toCardSections({ all: content.groups, groups });

  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">{t("No skills match.")}</p>
    );
  }

  const rows = (list: ContentGroup[], isSection = false) => (
    <div className="flex flex-col">
      {list.map((group) => (
        <SkillGroup
          defaultOpen={isFiltering || group.areaId === groups[0]?.areaId}
          group={group}
          isSection={isSection}
          // A new search remounts the groups, so they open to show what matched.
          key={`${group.areaId}:${isFiltering}`}
        />
      ))}
    </div>
  );

  if (!sections) {
    return rows(groups);
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section className="flex flex-col gap-1" key={section.key}>
          {section.header === "none" ? (
            rows(section.groups, true)
          ) : (
            <>
              <SectionHeader section={section} />
              {rows(section.groups)}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
