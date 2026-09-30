async function runAgain<T>({
  previous,
  run,
  wait,
}: {
  previous: T;
  run: (previous?: T) => Promise<T>;
  wait?: () => Promise<unknown>;
}): Promise<T> {
  await wait?.();
  return run(previous);
}

/**
 * Runs `run` one time after another, up to `times` times, until `done` accepts a result, calling
 * `wait` between runs; returns that result, or the last one. Each run gets the result before it.
 *
 * Workflow code repeats through this instead of a helper that calls itself: the Workflow DevKit's
 * graph extraction (`@workflow/builders` 5.0.0-beta.57) loses its cycle guard inside helpers with
 * a block body, so a self-calling helper that a workflow reaches overflows the stack, and the
 * build's manifest ships without any workflow graph.
 */
export function repeatUntil<T>({
  done,
  run,
  times,
  wait,
}: {
  done: (result: T) => boolean;
  run: (previous?: T) => Promise<T>;
  times: number;
  wait?: () => Promise<unknown>;
}): Promise<T> {
  return Array.from({ length: times - 1 }).reduce<Promise<T>>(
    (attempt) =>
      attempt.then((previous) => (done(previous) ? previous : runAgain({ previous, run, wait }))),
    run(),
  );
}
