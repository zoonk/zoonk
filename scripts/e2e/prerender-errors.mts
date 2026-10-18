import { stripVTControlCharacters } from "node:util";

const STACK_CONTEXT_LINES = 25;

/** Next can stream HTTP 200 while development validation reports a broken static/instant route. */
export function findPrerenderErrors(output: string) {
  const lines = stripVTControlCharacters(output)
    .replaceAll(String.raw`\"`, '"')
    .split("\n");

  const entries = lines.flatMap((line, index) => {
    const message = line.trim();

    const routeError =
      /(?:Error: )?Route "[^"\n]+"(?::| used | failed | did not ).*(?:Next\.js encountered|before accessing uncached data|outside of "use cache"|awaiting a promise created outside|took too long during prerendering|Unexpected cache miss after cache warming|render during instant validation|produce a static shell|Could not validate `instant`)/u;

    const namedError =
      /Error(?: \[[^\]\n]+\])?: (?:Invariant: )?(?:Blocking Route|Instant Navigation.*(?:failed|error)|An unexpected error occurred during validation)/iu;

    return routeError.test(message) || namedError.test(message) ? [[message, index] as const] : [];
  });

  return [...new Map(entries)].map(([message, index]) => ({
    context: lines.slice(index, index + STACK_CONTEXT_LINES).join("\n"),
    message,
  }));
}
