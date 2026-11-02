export function once<TValue>(compute: () => TValue): () => TValue {
  const memo: { kept?: { value: TValue } } = {};

  return () => {
    memo.kept ??= { value: compute() };
    return memo.kept.value;
  };
}
