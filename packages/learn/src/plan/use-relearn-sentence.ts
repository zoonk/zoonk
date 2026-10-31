import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { toTopicWords } from "../syllabus/topic-number";

const MAX_NAMED_TOPICS = 3;

const MAX_NAMED_SUBJECTS = 3;

export function useRelearnSentence() {
  const t = useExtracted();
  const format = useFormatter();

  return (change: Pick<PlanChangeView, "effect">): string => {
    const areas = change.effect?.topicsAdded ?? [];
    const topics = areas.flatMap((area) => area.topics.map((topic) => toTopicWords(topic)));

    if (topics.length <= MAX_NAMED_TOPICS) {
      return t(
        "{count, plural, one {{topics} is back in your plan: you missed a question on it.} other {{topics} are back in your plan: you missed questions on them.}}",
        { count: topics.length, topics: format.list(topics, { type: "conjunction" }) },
      );
    }

    const named = areas.slice(0, MAX_NAMED_SUBJECTS).map((area) => area.area);
    const more = areas.length - named.length;

    const subjects = [
      ...named,
      ...(more > 0
        ? [t("{count, plural, one {# other subject} other {# other subjects}}", { count: more })]
        : []),
    ];

    return t(
      "{count, plural, other {# topics from {subjects} are back in your plan: you missed questions on them.}}",
      { count: topics.length, subjects: format.list(subjects, { type: "conjunction" }) },
    );
  };
}
