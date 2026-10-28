"use client";

import { type ChallengeTopic } from "@zoonk/core/checkpoints/challenge-contract";
import { useExtracted, useFormatter } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PageSectionTitle } from "../_components/page";
import { TaskAsideContent } from "../_components/task-layout";
import { useChallengeScreen } from "./challenge-context";

type TopicRow = { subject: string | null; topics: string[] };

function getTopicRows(topics: readonly ChallengeTopic[]): TopicRow[] {
  const bySubject = Map.groupBy(topics, (topic) => topic.subject);

  return [...bySubject].flatMap(([subject, group]): TopicRow[] => {
    const names = [...new Set(group.map((topic) => topic.name))];

    return subject === null
      ? names.map((name) => ({ subject, topics: [name] }))
      : [{ subject, topics: names }];
  });
}

export function useTopicsTitle(): string | null {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();

  if (challenge.mock || challenge.topics.length === 0) {
    return null;
  }

  if (challenge.kind === "weekly") {
    return t("This week's topics");
  }

  return challenge.status === "done" ? t("What he asked") : t("What he'll ask");
}

export function ChallengeTopics() {
  const t = useExtracted();
  const format = useFormatter();
  const { challenge } = useChallengeScreen();
  const title = useTopicsTitle();
  const rows = getTopicRows(challenge.topics);

  if (!title || rows.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <PageSectionTitle className="lg:sr-only">{title}</PageSectionTitle>
      <ListGroup>
        {rows.map((row) => (
          <ListRow key={`${row.subject ?? ""}:${row.topics.join(",")}`}>
            <ListRowContent>
              <ListRowTitle>{row.subject ?? row.topics[0]}</ListRowTitle>
              {row.subject !== null && (
                <ListRowDescription className="line-clamp-2">
                  {format.list(row.topics, { style: "short", type: "unit" })}
                </ListRowDescription>
              )}
            </ListRowContent>
            {row.subject !== null && (
              <ListRowTrailing>
                {t("{count, plural, one {# topic} other {# topics}}", { count: row.topics.length })}
              </ListRowTrailing>
            )}
          </ListRow>
        ))}
      </ListGroup>
    </section>
  );
}

export function DuelBriefing({ rule }: { rule: string }) {
  const hasTopics = useTopicsTitle() !== null;

  const ruleLine = (
    <p className="text-muted-foreground text-[0.8125rem] leading-5 text-pretty">{rule}</p>
  );

  if (!hasTopics) {
    return ruleLine;
  }

  return (
    <TaskAsideContent className="flex w-full flex-col gap-6 lg:gap-8">
      <ChallengeTopics />
      {ruleLine}
    </TaskAsideContent>
  );
}
