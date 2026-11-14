"use client";

import { type ChallengeTopic } from "@zoonk/core/checkpoints/challenge-contract";
import { ListChecksIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { Disclosure } from "../_components/disclosure";
import {
  ListGroup,
  ListRow,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
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

function TopicRows() {
  const t = useExtracted();
  const format = useFormatter();
  const { challenge } = useChallengeScreen();

  return (
    <ListGroup>
      {getTopicRows(challenge.topics).map((row) => (
        <ListRow key={`${row.subject ?? ""}:${row.topics.join(",")}`}>
          <ListRowBody>
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
          </ListRowBody>
        </ListRow>
      ))}
    </ListGroup>
  );
}

export function ChallengeTopics() {
  const title = useTopicsTitle();

  if (!title) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <PageSectionTitle className="with-aside:sr-only">{title}</PageSectionTitle>
      <TopicRows />
    </section>
  );
}

/** Before a duel the topics wait behind one row on a phone, and sit open in the aside when there is one. */
export function DuelTopics() {
  const title = useTopicsTitle();

  if (!title) {
    return null;
  }

  return (
    <>
      <ListGroup className="with-aside:group-data-aside/task:hidden w-full">
        <Disclosure
          icon={
            <ListRowIcon>
              <ListChecksIcon />
            </ListRowIcon>
          }
          title={title}
        >
          <TopicRows />
        </Disclosure>
      </ListGroup>

      <TaskAsideContent className="with-aside:group-data-aside/task:block hidden w-full">
        <ChallengeTopics />
      </TaskAsideContent>
    </>
  );
}
