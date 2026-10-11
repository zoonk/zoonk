/**
 * `compute` run on the first call only, its value kept for the next ones: for a value that costs
 * real time and that most readers never ask for.
 */
export function once<TValue>(compute: () => TValue): () => TValue {
  const memo: { kept?: { value: TValue } } = {};

  return () => {
    memo.kept ??= { value: compute() };
    return memo.kept.value;
  };
}
