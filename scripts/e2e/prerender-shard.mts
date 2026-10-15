const SHARD_PATTERN = /^(?<index>[1-9]\d*)\/(?<total>[1-9]\d*)$/u;

/**
 * CI crawls on parallel runners because every first visit compiles its route in development.
 * `<index>/<total>` (1-based, like Playwright's `--shard`) deals pages out in turn, so each runner
 * gets a similar mix of heavy and light routes; without a shard, one run crawls every page.
 */
export function selectPrerenderShard<Item>({
  items,
  shard,
}: {
  items: readonly Item[];
  shard: string | undefined;
}) {
  if (!shard) {
    return items;
  }

  const match = SHARD_PATTERN.exec(shard);
  const index = Number(match?.groups?.index);
  const total = Number(match?.groups?.total);

  if (!match || index > total) {
    throw new Error(`Invalid prerender shard "${shard}"; expected <index>/<total>.`);
  }

  return items.filter((_item, position) => position % total === index - 1);
}
