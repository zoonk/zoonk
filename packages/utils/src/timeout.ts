import { toError } from "./error";

export type Settled<T> = { status: "settled"; value: T } | { status: "timedOut" };

/**
 * Waits for `request` for at most `ms`: its value when it settles in time, `timedOut` otherwise,
 * so a screen waiting on it can say so and offer to try again instead of hanging. A request that
 * answers later is ignored (it isn't cancelled), and a rejection passes through.
 */
export function settleWithin<T>({
  ms,
  request,
}: {
  ms: number;
  request: () => Promise<T>;
}): Promise<Settled<T>> {
  return new Promise<Settled<T>>((resolve, reject) => {
    const timer = setTimeout(() => resolve({ status: "timedOut" }), ms);

    Promise.resolve()
      .then(request)
      .then(
        (value) => resolve({ status: "settled", value }),
        (error: unknown) => reject(toError(error)),
      )
      .finally(() => clearTimeout(timer));
  });
}
