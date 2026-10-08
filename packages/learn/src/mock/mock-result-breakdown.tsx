"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepCard, StepRow, StepRows, StepTitle } from "../_components/step-card";

type Topic = MockResult["topics"][number];
type Area = MockResult["areas"][number];

/** Topics that went worst come first: they're what the learner looks for. */
function byShare(first: Topic, second: Topic): number {
  return first.correct / first.total - second.correct / second.total || second.total - first.total;
}

function useRightOf() {
  const t = useExtracted();

  return ({ correct, total }: { correct: number; total: number }) =>
    t("{correct} of {total}", { correct: String(correct), total: String(total) });
}

/** "300–470": a range, since one mock can't pin a score down. */
function useRange() {
  const t = useExtracted();

  return ({ high, low }: { high: number; low: number }) =>
    t("{low}–{high}", { high: String(high), low: String(low) });
}

/** Enough topics to see what went worst at a glance; the rest open on request. */
const TOPICS_SHOWN = 5;

function TopicList({ topics }: { topics: readonly Topic[] }) {
  const rightOf = useRightOf();

  return (
    <ul className="flex flex-col">
      {topics.map((topic) => (
        <li
          className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-sm"
          key={topic.skillId}
        >
          <span className="text-muted-foreground min-w-0">{topic.name}</span>
          <span className="shrink-0 font-medium tabular-nums">{rightOf(topic)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The topics that went worst first; past the first few, the rest open in place. */
function TopicRows({ topics }: { topics: readonly Topic[] }) {
  const t = useExtracted();
  const sorted = topics.toSorted(byShare);
  const first = sorted.slice(0, TOPICS_SHOWN);
  const rest = sorted.slice(TOPICS_SHOWN);

  return (
    <>
      <TopicList topics={first} />
      {rest.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group/more text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-10 items-center gap-1 rounded-lg text-sm font-medium outline-none focus-visible:ring-[3px]">
            {t("{count, plural, one {# more topic} other {# more topics}}", { count: rest.length })}
            <ChevronDownIcon
              aria-hidden="true"
              className="size-4 transition-transform group-data-panel-open/more:rotate-180 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <TopicList topics={rest} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}

/** An area with its score; its topics open under it. */
function AreaRow({ area, topics }: { area: Area; topics: readonly Topic[] }) {
  const rightOf = useRightOf();
  const range = useRange();
  const score = area.score ? range(area.score) : rightOf(area);

  if (topics.length === 0) {
    return (
      <StepRow className="justify-between">
        <span className="min-w-0 font-medium">{area.name}</span>
        <span className="shrink-0 font-semibold tabular-nums">{score}</span>
      </StepRow>
    );
  }

  return (
    <li className="border-border border-b last:border-b-0">
      <Collapsible>
        <CollapsibleTrigger className="group/area focus-visible:ring-ring/50 flex min-h-12 w-full items-center gap-3 rounded-lg py-3 text-left text-sm outline-none focus-visible:ring-[3px]">
          <span className="min-w-0 flex-1 font-medium">{area.name}</span>
          <span className="shrink-0 font-semibold tabular-nums">{score}</span>
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0 transition-transform group-data-panel-open/area:rotate-180 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <div className="pb-2">
            <TopicRows topics={topics} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

/** Whether the result has more than one thing to break down: areas, or a single area's topics. */
export function hasBreakdown(result: MockResult): boolean {
  return result.areas.length > 1 || result.topics.length > 1;
}

/**
 * How each part went: with several areas, each with its score and its topics a tap away (the ones
 * that went worst first); with one, its topics.
 */
export function MockResultBreakdown({ result }: { result: MockResult }) {
  const t = useExtracted();

  if (result.areas.length <= 1) {
    return (
      <StepCard>
        <StepTitle>{t("By topic")}</StepTitle>
        <div className="bg-muted/50 w-full rounded-2xl px-4 py-1 text-left">
          <TopicRows topics={result.topics} />
        </div>
      </StepCard>
    );
  }

  return (
    <StepCard>
      <StepTitle>{t("By area")}</StepTitle>
      <StepRows>
        {result.areas.map((area) => (
          <AreaRow
            area={area}
            key={area.name}
            topics={result.topics.filter((topic) => topic.area === area.name)}
          />
        ))}
      </StepRows>
    </StepCard>
  );
}
