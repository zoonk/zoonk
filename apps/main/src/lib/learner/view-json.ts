/** How a date travels in a learner view's JSON: the page's own render hands dates over as dates. */
const DATE_KEY = "$date";

type EncodedDate = { [DATE_KEY]: string };

function isEncodedDate(value: unknown): value is EncodedDate {
  return (
    typeof value === "object" &&
    value !== null &&
    DATE_KEY in value &&
    typeof value[DATE_KEY] === "string" &&
    Object.keys(value).length === 1
  );
}

function encodeDates(value: unknown): unknown {
  if (value instanceof Date) {
    return { [DATE_KEY]: value.toISOString() } satisfies EncodedDate;
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeDates(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeDates(item)]));
  }

  return value;
}

/**
 * A learner view as `GET /api/learner/views/{kind}` sends it, so the browser draws a view it read
 * again exactly as the page's render drew it: dates stay dates (`parseLearnerView`).
 */
export function stringifyLearnerView(value: unknown): string {
  return JSON.stringify(encodeDates(value));
}

/** Reads a learner view's JSON back, its dates as dates. */
export function parseLearnerView(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) =>
    isEncodedDate(value) ? new Date(value[DATE_KEY]) : value,
  );
}
