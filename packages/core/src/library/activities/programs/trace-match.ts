import { type TraceStep, type TracedValue } from "./program-runs";

type TraceValue = boolean | number | string;
type WrittenStep = { line: number; values: readonly { name: string; value: TraceValue }[] };
type Language = "javascript" | "python";

/** A value the tracer shows at a step: listed there, or kept from an earlier step. */
type ShownValue = { listed: boolean; name: string; value: TraceValue };

/** 0.1 + 0.2 may be written as 0.3. */
const NUMBER_TOLERANCE = 1e-9;
const NOTHING = new Set(["none", "null", "undefined"]);

/** Lists and objects compare without spaces, quote style or case, so `[1, 'a']` matches `[1,"A"]`. */
function canonical(text: string): string {
  return text.replaceAll(/\s+/gu, "").replaceAll('"', "'").toLowerCase();
}

function sameNumber(written: TraceValue, actual: number): boolean {
  const value =
    typeof written === "number" || (typeof written === "string" && written.trim() !== "")
      ? Number(written)
      : Number.NaN;

  return Math.abs(value - actual) <= NUMBER_TOLERANCE * Math.max(1, Math.abs(actual));
}

/**
 * Whether a written trace value says what the run had, forgiving how it's written: numbers as
 * text, quotes around strings, Python's True for true, and spacing inside lists.
 */
function sameValue(written: TraceValue, actual: TracedValue): boolean {
  switch (actual.kind) {
    case "boolean":
      return String(written).trim().toLowerCase() === String(actual.value);
    case "number":
      return sameNumber(written, actual.value);
    case "string":
      return [actual.value, `'${actual.value}'`, `"${actual.value}"`].includes(String(written));
    case "text": {
      const [first, second] = [canonical(String(written)), canonical(actual.text)];
      return first === second || (NOTHING.has(first) && NOTHING.has(second));
    }
    default:
      return false;
  }
}

const PYTHON_BOOLEANS = { false: "False", true: "True" } as const;

function describeValue(value: TracedValue, language: Language): string {
  switch (value.kind) {
    case "boolean":
      return language === "python" ? PYTHON_BOOLEANS[`${value.value}`] : String(value.value);
    case "number":
      return String(value.value);
    case "string":
      return JSON.stringify(value.value);
    case "text":
      return value.text;
    default:
      return "";
  }
}

/** What the tracer shows at each step: every watched value known so far, like the player. */
function shownValues(trace: readonly WrittenStep[], watch: readonly string[]): ShownValue[][] {
  const initial: { known: ReadonlyMap<string, TraceValue>; shown: ShownValue[][] } = {
    known: new Map(),
    shown: [],
  };

  return trace.reduce((state, step) => {
    const values = step.values.filter((item) => watch.includes(item.name));
    const listed = new Set(values.map((item) => item.name));

    const known = new Map([
      ...state.known,
      ...values.map((item) => [item.name, item.value] as const),
    ]);

    const shown = [...known].map(([name, value]) => ({ listed: listed.has(name), name, value }));
    return { known, shown: [...state.shown, shown] };
  }, initial).shown;
}

function actualValue(event: TraceStep, watch: readonly string[], name: string) {
  return event.values[watch.indexOf(name)] ?? null;
}

/**
 * A listed value must exist and match; a kept one only has to match where the variable still
 * has a value, since the tracer can't show a variable going out of scope.
 */
function showsTruth(item: ShownValue, actual: TracedValue | null): boolean {
  if (item.listed) {
    return actual !== null && sameValue(item.value, actual);
  }

  return (
    actual === null ||
    (actual.kind === "text" && actual.text === "undefined") ||
    sameValue(item.value, actual)
  );
}

function stepMismatch({
  events,
  index,
  language,
  shown,
  step,
  watch,
}: {
  events: readonly TraceStep[];
  index: number;
  language: Language;
  shown: readonly ShownValue[];
  step: WrittenStep;
  watch: readonly string[];
}): string {
  const where = `Step ${index + 1} is line ${step.line}`;
  const event = events.find((candidate) => candidate.line === step.line);

  if (!event) {
    return index === 0
      ? `${where}, but running the code never reaches line ${step.line}`
      : `${where}, but running the code, line ${step.line} doesn't run again after step ${index}`;
  }

  const wrong = shown.find((item) => !showsTruth(item, actualValue(event, watch, item.name)));

  if (!wrong) {
    return `${where}, but running the code doesn't reach it with these values`;
  }

  const actual = actualValue(event, watch, wrong.name);
  const kept = wrong.listed ? "" : " (kept from an earlier step, so list its new value here)";

  const real = actual
    ? `it's ${describeValue(actual, language)}`
    : `${wrong.name} doesn't exist yet`;

  return `${where} and shows ${wrong.name} = ${String(wrong.value)}${kept}, but running the code, ${real} there`;
}

/**
 * Checks a written trace against a real run. Steps may skip lines but must follow the order the
 * lines ran, and every value the tracer shows at a step must be what the program had right after
 * that line. Returns the first step that doesn't hold, with a message for the writer's fix step.
 */
export function findTraceMismatch({
  events,
  language,
  trace,
  watch,
}: {
  events: readonly TraceStep[];
  language: Language;
  trace: readonly WrittenStep[];
  watch: readonly string[];
}): { index: number; message: string } | null {
  const shown = shownValues(trace, watch);

  const initial: { cursor: number; mismatch: { index: number; message: string } | null } = {
    cursor: 0,
    mismatch: null,
  };

  return trace.reduce((state, step, index) => {
    if (state.mismatch) {
      return state;
    }

    const stepShown = shown[index] ?? [];

    const found = events.findIndex(
      (event, position) =>
        position >= state.cursor &&
        event.line === step.line &&
        stepShown.every((item) => showsTruth(item, actualValue(event, watch, item.name))),
    );

    if (found !== -1) {
      return { cursor: found + 1, mismatch: null };
    }

    const message = stepMismatch({
      events: events.slice(state.cursor),
      index,
      language,
      shown: stepShown,
      step,
      watch,
    });

    return { cursor: state.cursor, mismatch: { index, message } };
  }, initial).mismatch;
}
