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
 * Workflow code repeats through this instead of a self-calling helper: the Workflow DevKit's graph
 * extraction overflows the stack on one, and the build ships without any workflow graph.
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
