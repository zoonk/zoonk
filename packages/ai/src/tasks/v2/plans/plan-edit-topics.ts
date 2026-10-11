import { normalizeString } from "@zoonk/utils/string";
import { decodeHtmlEntities } from "../../_utils/html-entities";
import { matchAreas } from "./plan-edit-areas";

/** A request adds a handful of topics; more is a new goal, not a change to this plan. */
const MAX_TOPICS = 4;
const MAX_TOPIC_NAME_LENGTH = 80;
const MAX_TOPIC_DESCRIPTION_LENGTH = 200;

/**
 * A topic the learner asked the plan to add (SQL in an interview, a portfolio project), named as a
 * skill a course would teach, under the plan's area it belongs to (null for none). Core finds or
 * creates its Library skill and adds it to the plan as the learner's next work.
 */
export type PlanEditTopic = { area: string | null; description: string; name: string };

function cleanText({ max, text }: { max: number; text: string }): string {
  return decodeHtmlEntities(text).replaceAll(/\s+/gu, " ").trim().slice(0, max);
}

/**
 * Topics with a name, once each, under an area the plan has (the plan's own spelling) or none,
 * starting on the day the learner said (`startDate`) or spread through what the plan teaches next
 * (null).
 */
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
