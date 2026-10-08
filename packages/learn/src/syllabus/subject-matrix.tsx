"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import {
  LIST_GROUP_CLASS,
  LIST_ROW_INTERACTIVE_CLASS,
  ListRow,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { type TopicGroup, groupTopics } from "./topic-number";
import { TopicNumber } from "./topic-number-label";

/** Competências in sight before "See all". */
const SHOWN_GROUPS = 2;

/**
 * A named item's label and its words, as a matrix writes them ("Competência de área 1 – Compreender
 * as ciências…"): the label goes under the words, quietly, so the row leads with what it asks.
 */
const NAMED_ITEM = /^(?<label>[^–—:-]{2,40}?\s\d{1,3})\s*[-–—:]\s+(?<text>\S.*)$/su;

function splitNamedItem(text: string): { label: string | null; text: string } {
  const named = NAMED_ITEM.exec(text)?.groups;

  return named?.label && named.text
    ? { label: named.label, text: named.text }
    : { label: null, text };
}

type MatrixGroup = TopicGroup<{ name: string }>;

/** One competência: its words, its label and skills under them, opening in place to its skills. */
function MatrixGroupRow({ group }: { group: MatrixGroup }) {
  const t = useExtracted();
  const { label, text } = splitNamedItem(group.text);

  // "Competência de área 1 · 4 skills": the group's own label and how many skills it holds.
  const skills =
    group.children.length > 0
      ? t("{count, plural, one {# skill} other {# skills}}", { count: group.children.length })
      : null;

  const line = [label, skills].filter(Boolean).join(" · ");

  const content = (
    <ListRowContent>
      <ListRowTitle className="line-clamp-3">
        <TopicNumber number={group.number} />
        {text}
      </ListRowTitle>
      {line && <ListRowDescription>{line}</ListRowDescription>}
    </ListRowContent>
  );

  if (group.children.length === 0) {
    return <ListRow>{content}</ListRow>;
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className={cn(LIST_ROW_INTERACTIVE_CLASS, "group/matrix")}>
        {content}
        <ChevronDownIcon
          aria-hidden="true"
          className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-data-panel-open/matrix:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <ul className="bg-muted/40 text-muted-foreground flex flex-col gap-2 px-4 py-3 text-sm">
          {group.children.map((child) => (
            <li className={cn("text-pretty", child.depth > 1 && "pl-5")} key={child.topic.name}>
              <TopicNumber number={child.number} />
              {child.text}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The notice's skills matrix for a subject (ENEM's competências and habilidades), under its
 * contents: what the questions ask the learner to do with them. Each competência is a row with its
 * label and how many skills it holds, opening in place to its skills with their codes, so a
 * learner can check every one against the notice; the first two are in sight, the rest a tap away.
 */
export function SubjectMatrix({ matrix }: { matrix: readonly string[] }) {
  const t = useExtracted();
  const titleId = useId();
  const [showAll, setShowAll] = useState(false);

  if (matrix.length === 0) {
    return null;
  }

  const groups = groupTopics(matrix.map((name) => ({ name })));
  const skills = groups.reduce((sum, group) => sum + Math.max(1, group.children.length), 0);
  const shown = showAll ? groups : groups.slice(0, SHOWN_GROUPS);
  const hidden = groups.length - shown.length;

  return (
    <PageSection aria-labelledby={titleId} data-slot="subject-matrix">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("What the questions ask")}</PageSectionTitle>
        <PageSectionDetail>
          {t("{count, plural, one {# skill} other {# skills}}", { count: skills })}
        </PageSectionDetail>
      </PageSectionHeader>

      <ul aria-labelledby={titleId} className={LIST_GROUP_CLASS}>
        {shown.map((group) => (
          <li key={group.topic.name}>
            <MatrixGroupRow group={group} />
          </li>
        ))}

        {hidden > 0 && (
          <li>
            <ListRowButton onClick={() => setShowAll(true)}>
              <ListRowContent className="min-h-12 py-2.5">
                <ListRowTitle>
                  {t("See all {count, number}", { count: groups.length })}
                </ListRowTitle>
              </ListRowContent>
            </ListRowButton>
          </li>
        )}
      </ul>
    </PageSection>
  );
}
