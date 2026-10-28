import { normalizeString } from "@zoonk/utils/string";
import { decodeHtmlEntities } from "../../_utils/html-entities";
import { matchAreas } from "./plan-edit-areas";

/** A request adds a handful of topics; more is a new goal, not a change to this plan. */
const MAX_TOPICS = 4;
const MAX_TOPIC_NAME_LENGTH = 80;
const MAX_TOPIC_DESCRIPTION_LENGTH = 200;

/** `area` is null when the topic belongs to none of the plan's. */
export type PlanEditTopic = { area: string | null; description: string; name: string };

function cleanText({ max, text }: { max: number; text: string }): string {
  return decodeHtmlEntities(text).replaceAll(/\s+/gu, " ").trim().slice(0, max);
}

/** A null `startDate` spreads the topics through what the plan teaches next. */
export function toTopicsOperation({
  areas,
  startDate,
  topics,
}: {
  areas: readonly string[];
  startDate: string | null;
  topics: readonly PlanEditTopic[];
}): { kind: "addTopics"; startDate: string | null; topics: PlanEditTopic[] } | null {
  const cleaned = topics
    .map((topic) => ({
      area: matchAreas({ areas, values: topic.area ? [topic.area] : [] })[0] ?? null,
      description: cleanText({ max: MAX_TOPIC_DESCRIPTION_LENGTH, text: topic.description }),
      name: cleanText({ max: MAX_TOPIC_NAME_LENGTH, text: topic.name }),
    }))
    .filter((topic) => topic.name.length > 0)
    .filter(
      (topic, index, all) =>
        all.findIndex((other) => normalizeString(other.name) === normalizeString(topic.name)) ===
        index,
    )
    .slice(0, MAX_TOPICS);

  return cleaned.length > 0 ? { kind: "addTopics", startDate, topics: cleaned } : null;
}
