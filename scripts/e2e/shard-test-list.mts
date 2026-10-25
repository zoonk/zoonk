type Shard = { current: number; total: number };

const SHARD_ARGUMENT = /^--shard(?:=(?<value>\d+\/\d+))?$/u;
const SHARD_VALUE = /^(?<current>\d+)\/(?<total>\d+)$/u;

function parseShard(value: string | undefined): Shard {
  const groups = SHARD_VALUE.exec(value ?? "")?.groups;
  const current = Number(groups?.current);
  const total = Number(groups?.total);

  if (!groups || current < 1 || current > total) {
    throw new Error(`Invalid shard "${value}": use --shard=<current>/<total>.`);
  }

  return { current, total };
}

/** Playwright's `--shard=2/12` (or `--shard 2/12`) among a run's arguments, and the rest of them. */
export function takeShardArgument(args: readonly string[]): {
  rest: string[];
  shard: Shard | null;
} {
  const index = args.findIndex((arg) => SHARD_ARGUMENT.test(arg));

  if (index === -1) {
    return { rest: [...args], shard: null };
  }

  const inline = SHARD_ARGUMENT.exec(args[index] ?? "")?.groups?.value;
  const length = inline ? 1 : 2;
  const shard = parseShard(inline ?? args[index + 1]);

  return { rest: args.toSpliced(index, length), shard };
}

/**
 * A shard's share of a suite listed by `playwright test --list`, as a test list
 * (`--test-list`): every `total`-th test from the `current`-th, in file order, so each file's
 * tests, and their time, spread over every shard. Playwright's own `--shard` cuts the suite into
 * contiguous runs, which put a file's slow tests in one shard.
 */
export function dealShardTests({ listing, shard }: { listing: string; shard: Shard }): string {
  return listing
    .split("\n")
    .filter((line) => /^\s+\[[^\]]+\] › /u.test(line))
    .map((line) => line.trim())
    .filter((_, index) => index % shard.total === shard.current - 1)
    .join("\n");
}
