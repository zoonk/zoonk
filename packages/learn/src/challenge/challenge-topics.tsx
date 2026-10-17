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
import { TaskAsideContent } from "../_components/task-layout";
import { useChallengeScreen } from "./challenge-context";

/** A row of what a duel asks: a subject with its topics, or one topic of a goal of one subject. */
type TopicRow = { subject: string | null; topics: string[] };

/** The topics as rows: one per subject with its topics, in plan order, else one per topic. */
function getTopicRows(topics: readonly ChallengeTopic[]): TopicRow[] {
  const bySubject = Map.groupBy(topics, (topic) => topic.subject);

  return [...bySubject].flatMap(([subject, group]): TopicRow[] => {
    const names = [...new Set(group.map((topic) => topic.name))];

    return subject === null
      ? names.map((name) => ({ subject, topics: [name] }))
      : [{ subject, topics: names }];
  });
}

/**
 * What a duel's topics are called: what the Trickster will ask (or asked, once beaten), or the
 * week's topics. Null for a mock, which lists its sections, and while none are known (the week's
 * challenge before its day).
 */
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

/**
 * What the duel asks about, so the learner can see it coming: each subject with how many of its
 * topics and their first names under it, or each topic where the goal has one subject. Nothing
 * when it isn't known yet. From `lg` the aside's header names it (`useChallengeIntroAside`), so
 * its own label is for screen readers.
 */
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
      <h3 className="text-label lg:sr-only">{title}</h3>
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

/**
 * What a duel asks about and its one rule: under the facts on a phone, beside the intro from `lg`,
 * rendered once. While its topics aren't known (the week's challenge before its day), the rule
 * stays under the facts at every size: alone at the top of the aside it would read as a stray line.
 */
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
