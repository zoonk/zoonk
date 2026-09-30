import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";

type TraceValue = string | number | boolean;
type TraceStep = { line: number; values: readonly { name: string; value: TraceValue }[] };
type Pause = { step: number };

/** A watched variable at one step: its value so far, the value before, and whether it changed. */
export type WatchedValue = {
  changed: boolean;
  name: string;
  previous: string | null;
  value: string | null;
};

function valueAt(trace: readonly TraceStep[], name: string, step: number): string | null {
  const known = trace
    .slice(0, step + 1)
    .flatMap((item) => item.values.filter((entry) => entry.name === name));

  const last = known.at(-1);
  return last === undefined ? null : String(last.value);
}

/**
 * The watched variables at a step. A trace step lists only the values it shows, so a variable
 * keeps its last known value until a step changes it.
 */
export function watchedValues({
  step,
  trace,
  watch,
}: {
  step: number;
  trace: readonly TraceStep[];
  watch: readonly string[];
}): WatchedValue[] {
  return watch.map((name) => {
    const value = step < 0 ? null : valueAt(trace, name, step);
    const previous = step < 1 ? null : valueAt(trace, name, step - 1);
    return { changed: previous !== null && value !== previous, name, previous, value };
  });
}

/** The first step shown: before the first line when the learner must predict it. */
export function firstStep(pauses: readonly Pause[]): number {
  return pauses.some((pause) => pause.step === 0) ? -1 : 0;
}

/** The pause guarding the next step, if the learner hasn't predicted it yet. */
export function blockingPause<TPause extends Pause>({
  pauses,
  predictions,
  step,
}: {
  pauses: readonly TPause[];
  predictions: Readonly<Record<string, string>>;
  step: number;
}): { index: number; pause: TPause } | null {
  const index = pauses.findIndex(
    (pause, position) => pause.step === step + 1 && predictions[String(position)] === undefined,
  );

  const pause = pauses[index];
  return pause ? { index, pause } : null;
}

/** The pause the learner is about to reach: the one right after the current step. */
export function upcomingPause<TPause extends Pause>(
  pauses: readonly TPause[],
  step: number,
): { index: number; pause: TPause } | null {
  const index = pauses.findIndex((pause) => pause.step === step + 1);
  const pause = pauses[index];
  return pause ? { index, pause } : null;
}

/** The answer once every pause has a prediction: pause position to the chosen option. */
export function tracerAnswer(
  pauses: readonly Pause[],
  predictions: Readonly<Record<string, string>>,
): Extract<ActivityAnswer, { kind: "assignment" }> | null {
  const keys = pauses.map((_, index) => String(index));

  if (keys.some((key) => predictions[key] === undefined)) {
    return null;
  }

  return {
    kind: "assignment",
    pairs: Object.fromEntries(keys.map((key) => [key, predictions[key] ?? ""])),
  };
}
