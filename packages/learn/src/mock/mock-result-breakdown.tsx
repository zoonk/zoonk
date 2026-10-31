"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { StepRow, StepRows } from "../_components/step-card";
import { ResultSection } from "./mock-result-section";

type Topic = MockResult["topics"][number];
type Area = MockResult["areas"][number];

function byShare(first: Topic, second: Topic): number {
  return first.correct / first.total - second.correct / second.total || second.total - first.total;
}

function useRightOf() {
  const t = useExtracted();
  const format = useFormatter();

  return ({ correct, total }: { correct: number; total: number }) =>
    t("{correct} of {total}", {
      correct: format.number(correct, { maximumFractionDigits: 2 }),
      total: String(total),
    });
}

export function useMockRange() {
  const t = useExtracted();

  return ({ high, low }: { high: number; low: number }) =>
    t("{low}–{high}", { high: String(high), low: String(low) });
}

const TOPICS_SHOWN = 5;

function TopicList({ topics }: { topics: readonly Topic[] }) {
  const rightOf = useRightOf();

  return (
    <ul className="flex flex-col">
      {topics.map((topic) => (
        <li
          className="border-border flex min-h-10 items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0"
          key={topic.skillId}
        >
          <span className="text-muted-foreground min-w-0">{topic.name}</span>
          <span className="text-foreground shrink-0 font-mono text-xs tabular-nums">
            {rightOf(topic)}
          </span>
        </li>
      ))}
    </ul>
  );
}

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

function AreaRow({ area, topics }: { area: Area; topics: readonly Topic[] }) {
  const rightOf = useRightOf();
  const range = useMockRange();
  const score = area.score ? range(area.score) : rightOf(area);

  if (topics.length === 0) {
    return (
      <StepRow className="justify-between">
        <span className="min-w-0 font-medium">{area.name}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums">{score}</span>
      </StepRow>
    );
  }

  return (
    <li className="border-border border-b last:border-b-0">
      <Collapsible>
        <CollapsibleTrigger className="group/area focus-visible:ring-ring/50 flex min-h-12 w-full items-center gap-3 rounded-lg py-3 text-left text-sm outline-none focus-visible:ring-[3px]">
          <span className="min-w-0 flex-1 font-medium">{area.name}</span>
          <span className="shrink-0 font-mono text-xs tabular-nums">{score}</span>
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0 transition-transform group-data-panel-open/area:rotate-180 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <div className="pb-2 pl-4">
            <TopicRows topics={topics} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

export function hasBreakdown(result: MockResult): boolean {
  return result.areas.length > 1 || result.topics.length > 1;
}

export function MockResultBreakdown({ result }: { result: MockResult }) {
  const t = useExtracted();

  if (result.areas.length <= 1) {
    return (
      <ResultSection title={t("By topic")}>
        <TopicRows topics={result.topics} />
      </ResultSection>
    );
  }

  return (
    <ResultSection title={t("By area")}>
      <StepRows>
        {result.areas.map((area) => (
          <AreaRow
            area={area}
            key={area.name}
            topics={result.topics.filter((topic) => topic.area === area.name)}
          />
        ))}
      </StepRows>
    </ResultSection>
  );
}
