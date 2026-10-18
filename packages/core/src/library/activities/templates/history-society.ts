import { z } from "zod";
import {
  citationSchema,
  explanationSchema,
  idSchema,
  labelSchema,
  optionTextSchema,
  promptSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { slugSchema } from "../activity-schemas";
import { describeBaseMaps, getActivityBaseMap, isOnBaseMap } from "../base-maps";
import { type ActivityIssue, defineActivityTemplate } from "../define-activity-template";
import { hasOverlappingPassages } from "../excerpt-passages";
import { duplicateIssues, issue } from "./_utils/template-helpers";

const MAX_ANCHORS = 4;
const MAX_EVENTS = 6;
const MAX_PLACES = 8;
const MAX_NODES = 8;
const MAX_LINKS = 8;
const MAX_PASSAGES = 4;
const MAX_EXCERPT_LENGTH = 600;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

const datedSchema = z
  .object({ id: idSchema, label: optionTextSchema, year: z.number().int() })
  .strict();

const timelineFields = z
  .object({
    anchors: z
      .array(z.object({ label: optionTextSchema, year: z.number().int() }).strict())
      .min(1)
      .max(MAX_ANCHORS),
    end: z.number().int(),
    events: uniqueIdsSchema(datedSchema, { max: MAX_EVENTS, min: 2 }),
    start: z.number().int(),
  })
  .strict();

type TimelineFields = z.output<typeof timelineFields>;

function timelineIssues(fields: TimelineFields) {
  const years = [...fields.anchors, ...fields.events].map((item) => item.year);

  return [
    fields.end <= fields.start &&
      issue("missingInteraction", "fields", "The timeline has no range"),
    years.some((year) => year < fields.start || year > fields.end) &&
      issue("inconsistentFields", "fields.events", "An event is outside the timeline"),
    new Set(fields.events.map((event) => event.year)).size !== fields.events.length &&
      issue(
        "inconsistentFields",
        "fields.events",
        "Two events share a year, so their order is unclear",
      ),
  ].filter((item) => item !== false);
}

export const timelineTemplate = defineActivityTemplate({
  checks: ["interaction", "choice"],
  description:
    "Place events on a true-to-scale axis to see how far apart they really are. Years are whole numbers, negative for BCE; code orders the events by year. Fills: the axis range, anchor events with dates, the events to place and the check question.",
  expected: (fields) => ({
    ids: fields.events.toSorted((a, b) => a.year - b.year).map((event) => event.id),
    kind: "order",
  }),
  fields: timelineFields,
  id: "timeline",
  needsData: false,
  verify: (fields) => timelineIssues(fields),
});

const placeSchema = z
  .object({
    id: idSchema,
    label: labelSchema,
    latitude: z.number().min(-MAX_LATITUDE).max(MAX_LATITUDE),
    longitude: z.number().min(-MAX_LONGITUDE).max(MAX_LONGITUDE),
    reveals: explanationSchema,
  })
  .strict();

type MapExplorerFields = { baseMapId: string; places: z.output<typeof placeSchema>[] };

/** The map must be one the player can draw, and every place must fall inside it. */
function mapExplorerIssues(fields: MapExplorerFields): ActivityIssue[] {
  const map = getActivityBaseMap(fields.baseMapId);

  if (!map) {
    return [issue("unknownAsset", "fields.baseMapId", `No base map "${fields.baseMapId}"`)];
  }

  return fields.places
    .map((place, index) => ({ index, place }))
    .filter(({ place }) => !isOnBaseMap(map, place))
    .map(({ index, place }) =>
      issue(
        "inconsistentFields",
        `fields.places.${index}`,
        `"${place.label}" is outside the "${map.id}" base map`,
      ),
    );
}

export const mapExplorerTemplate = defineActivityTemplate({
  checks: ["choice"],
  description: `Tap places on a map to uncover evidence, like John Snow tracing the 1854 cholera outbreak to one pump. Pick a base map and give each place real coordinates inside it (latitude north positive, longitude east positive). Base maps: ${describeBaseMaps()}. Fills: the base map, places with coordinates, what each tap reveals and the check question.`,
  fields: z
    .object({
      baseMapId: slugSchema,
      places: uniqueIdsSchema(placeSchema, { max: MAX_PLACES, min: 2 }),
    })
    .strict(),
  id: "mapExplorer",
  needsData: true,
  verify: (fields) => mapExplorerIssues(fields),
});

const causeEffectFields = z
  .object({
    links: z
      .array(z.object({ from: idSchema, to: idSchema, why: explanationSchema }).strict())
      .min(1)
      .max(MAX_LINKS),
    nodes: uniqueIdsSchema(
      z
        .object({ id: idSchema, label: optionTextSchema, year: z.number().int().optional() })
        .strict(),
      { max: MAX_NODES, min: 3 },
    ),
  })
  .strict();

type CauseEffectFields = z.output<typeof causeEffectFields>;

function reachesItself(fields: CauseEffectFields, start: string): boolean {
  const walk = (current: ReadonlySet<string>): boolean => {
    const next = new Set(
      fields.links.filter((link) => current.has(link.from)).map((link) => link.to),
    );

    if (next.has(start)) {
      return true;
    }

    const grown = new Set([...current, ...next]);
    return grown.size !== current.size && walk(grown);
  };

  return walk(new Set([start]));
}

function causeEffectIssues(fields: CauseEffectFields) {
  const nodes = new Map(fields.nodes.map((node) => [node.id, node]));
  const linked = new Set(fields.links.flatMap((link) => [link.from, link.to]));

  return [
    fields.links.some(
      (link) => !nodes.has(link.from) || !nodes.has(link.to) || link.from === link.to,
    ) && issue("inconsistentFields", "fields.links", "A link must join two different listed nodes"),
    ...duplicateIssues(
      fields.links.map((link) => `${link.from} → ${link.to}`),
      "fields.links",
      "Link",
    ),
    fields.nodes.some((node) => reachesItself(fields, node.id)) &&
      issue("inconsistentFields", "fields.links", "The links go in a circle"),
    fields.links.some((link) => {
      const [from, to] = [nodes.get(link.from)?.year, nodes.get(link.to)?.year];
      return from !== undefined && to !== undefined && from > to;
    }) && issue("answerMismatch", "fields.links", "A cause is dated after its effect"),
    fields.nodes.some((node) => !linked.has(node.id)) &&
      issue("inconsistentFields", "fields.nodes", "Every node must be part of a link"),
  ].filter((item) => item !== false);
}

export const causeEffectChainTemplate = defineActivityTemplate({
  checks: ["interaction", "choice"],
  description:
    "Link causes to their effects, like plowed-up prairie and drought turning into the Dust Bowl. Code checks the links run forward in time and never loop. Fills: causes and effects with dates, the correct links with why, and the check question.",
  expected: (fields) => ({
    kind: "links",
    links: fields.links.map((link) => ({ from: link.from, to: link.to })),
  }),
  fields: causeEffectFields,
  id: "causeEffectChain",
  needsData: false,
  verify: (fields) => causeEffectIssues(fields),
});

const sourceSchema = z
  .object({
    author: labelSchema,
    citation: citationSchema,
    date: labelSchema,
    excerpt: z.string().min(1).max(MAX_EXCERPT_LENGTH),
    id: idSchema,
    passages: z
      .array(z.object({ id: idSchema, isTarget: z.boolean(), text: optionTextSchema }).strict())
      .min(1)
      .max(MAX_PASSAGES),
  })
  .strict();

type SourceComparisonFields = { markPrompt: string; sources: z.output<typeof sourceSchema>[] };

function passageIssues(fields: SourceComparisonFields) {
  const passages = fields.sources.flatMap((source) => source.passages);

  return [
    ...duplicateIssues(
      passages.map((passage) => passage.id),
      "fields.sources",
      "Passage",
    ),
    ...fields.sources.flatMap((source, index) =>
      source.passages
        .filter((passage) => !source.excerpt.includes(passage.text))
        .map(() =>
          issue(
            "inconsistentFields",
            `fields.sources.${index}.passages`,
            "A passage isn't quoted from its excerpt",
          ),
        ),
    ),
    ...fields.sources
      .filter((source) => hasOverlappingPassages(source.excerpt, source.passages))
      .map(() =>
        issue(
          "inconsistentFields",
          "fields.sources",
          "Two passages share words, so each passage must be a separate part of the excerpt",
        ),
      ),
    ...(passages.some((passage) => passage.isTarget)
      ? []
      : [issue("missingInteraction", "fields.sources", "No passage is there to find")]),
  ];
}

export const sourceComparisonTemplate = defineActivityTemplate({
  checks: ["interaction", "choice"],
  description:
    "Read two eyewitness sources side by side and mark passages, like two accounts of Lexington in 1775, to see how who wrote a source shapes it. Each passage must be quoted exactly from its excerpt. Fills: two short excerpts with author, date and citation, the passages to mark, what to mark and the check question.",
  expected: (fields) => ({
    ids: fields.sources.flatMap((source) =>
      source.passages.filter((passage) => passage.isTarget).map((passage) => passage.id),
    ),
    kind: "selection",
  }),
  fields: z
    .object({
      markPrompt: promptSchema,
      sources: uniqueIdsSchema(sourceSchema, { max: 2, min: 2 }),
    })
    .strict(),
  id: "sourceComparison",
  needsData: false,
  verify: (fields) => passageIssues(fields),
});
