"use client";

import { type SyllabusTopic } from "@zoonk/core/view-models/syllabus/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { groupTopics } from "./topic-number";

/** A sub-item sits under its item: "1.1" one step in from "1", "1.1.1" two. */
const SUMMARY_INDENT = ["", "pl-4", "pl-8"] as const;

/** A topic in the notice's own words, its number dropped for its nesting, marked when left out. */
function SummaryTopic({
  depth,
  text,
  topic,
}: {
  depth: number;
  text: string;
  topic: SyllabusTopic;
}) {
  const t = useExtracted();
  const leftOut = topic.status === "notPlanned";
  const indent = SUMMARY_INDENT[Math.min(depth, SUMMARY_INDENT.length - 1)];

  return (
    <li className={cn(indent, leftOut && "text-muted-foreground/70")}>
      {text}
      {leftOut && (
        <span className="text-muted-foreground ml-1.5 text-xs whitespace-nowrap">
          {`· ${t("Out of your plan")}`}
        </span>
      )}
    </li>
  );
}

/** A subject's topics as the notice's outline: each item, with the items under it stepped in. */
export function SummaryTopics({ topics }: { topics: readonly SyllabusTopic[] }) {
  return (
    <ul className="text-muted-foreground flex flex-col gap-1 pt-1 pb-3 pl-11 text-sm">
      {groupTopics(topics).flatMap((group) => [
        <SummaryTopic depth={0} key={group.topic.name} text={group.text} topic={group.topic} />,
        ...group.children.map((child) => (
          <SummaryTopic
            depth={child.depth}
            key={child.topic.name}
            text={child.text}
            topic={child.topic}
          />
        )),
      ])}
    </ul>
  );
}
