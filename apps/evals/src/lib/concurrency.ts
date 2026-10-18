type IndexedResult<TResult> = { index: number; result: PromiseSettledResult<TResult> };

function settle<TResult>(promise: Promise<TResult>): Promise<PromiseSettledResult<TResult>> {
  return promise.then(
    (value): PromiseFulfilledResult<TResult> => ({ status: "fulfilled", value }),
    (error: unknown): PromiseRejectedResult => ({ reason: error, status: "rejected" }),
  );
}

/**
 * Settles every item like `Promise.allSettled` but keeps at most `concurrency`
 * calls in flight. Latency is only comparable between models when a run does
 * not queue dozens of its own requests behind each other at the provider.
 */
export async function settleWithConcurrency<TItem, TResult>({
  concurrency,
  items,
  run,
}: {
  concurrency: number;
  items: readonly TItem[];
  run: (item: TItem) => Promise<TResult>;
}): Promise<PromiseSettledResult<TResult>[]> {
  const queue = items.map((item, index) => ({ index, item }));

  async function drain(): Promise<IndexedResult<TResult>[]> {
    const next = queue.shift();

    if (!next) {
      return [];
    }

    const result = await settle(run(next.item));
    return [{ index: next.index, result }, ...(await drain())];
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => drain());
  const drained = await Promise.all(workers);

  return drained
    .flat()
    .toSorted((a, b) => a.index - b.index)
    .map((entry) => entry.result);
}
