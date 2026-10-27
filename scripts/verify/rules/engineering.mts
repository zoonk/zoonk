import { CODE, type Rule, SERVER_SOURCE, SOURCE, TESTS, UI } from "./shared.mts";

/** What a principal engineer questions: rendering, React, data, caching, migrations and leftovers. */
export const ENGINEERING_RULES: Rule[] = [
  {
    files: SOURCE,
    line: /^\s*["']use client["']/u,
    name: "Client component",
    question:
      "What here needs the browser (state, an effect, a handler, a browser API)? Keep the page a Server Component and move only that part into a small client leaf.",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /\buse(?:Layout)?Effect\(/u,
    name: "Effect",
    question:
      "Does this sync with something outside React (a subscription, a browser API, a timer)? If it derives state, answers an event or loads data, it isn't an effect: compute it while rendering, do it in the handler, or read it on the server.",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /\bfetch\(|\buse(?:SWR|Query)\(/u,
    name: "Data fetched in the browser",
    question:
      "Could the server read this with the page (a Server Component through @zoonk/core) so it arrives already rendered?",
    role: "engineering",
    side: "client",
  },
  {
    files: SOURCE,
    line: /\buse(?:Memo|Callback)\(|\bmemo\(/u,
    name: "Manual memoization",
    question: "The React Compiler memoizes Main and the API: what does this add that it doesn't?",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /\b(?:setInterval|setTimeout|addEventListener)\(|new (?:Resize|Intersection|Mutation)Observer\(/u,
    name: "Timer or listener",
    question:
      "Is it removed when the component unmounts or the request ends? One left running leaks memory and keeps firing.",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /\brouter\.refresh\(/u,
    name: "Whole-page refresh",
    question:
      "Does the whole page need to render again, or would the action's own revalidation of what it changed do?",
    role: "engineering",
  },
  {
    files: UI,
    line: /suppressHydrationWarning|\btypeof window\b|\b(?:localStorage|sessionStorage)\b|\bnavigator\./u,
    name: "Server and browser may differ",
    question:
      "Is this read while rendering? The server renders without it (a hydration mismatch or a flash): read it in an event, or on the server.",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /\bMath\.random\(|\bnew Date\(\)|\bDate\.now\(/u,
    name: "Value that changes each render",
    question:
      "Does a render or a cached function use it? It makes prerendering and caching unstable: cache the work by its inputs, or seed it.",
    role: "engineering",
  },
  {
    created: /\/loading\.tsx$/u,
    files: UI,
    line: /<Suspense\b|fallback=/u,
    name: "Loading state",
    question:
      "Will learners see this fallback on an everyday page? The bar is no visible skeleton: make that content part of the static shell or cached data.",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /["']use cache\b|\bcacheLife\(|\bcacheTag\(/u,
    name: "Cached work",
    question:
      "Does anything inside depend on the learner (session, cookies, headers, their ids)? Then it's `use cache: private` or takes them as arguments. Are Next's default lifetimes enough (no cacheLife), and does a write expire exactly this tag?",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /\b(?:revalidatePath|revalidateTag|updateTag|refresh)\(/u,
    name: "Cache expiry",
    question: "Does it expire only what this change made stale, for the right learner?",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /\.findMany\(/u,
    name: "List read",
    question:
      "Is the result bounded (`take`, a page size) and read once per request, not once per item in a loop?",
    role: "engineering",
  },
  {
    files: SERVER_SOURCE,
    line: /\.map\(async\b|\bfor await\b/u,
    name: "Work per item",
    question:
      "Does each item read or write the database or call a service? Then it's one round trip per item (N+1): read them all in one query, or say why the count stays small.",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /\$transaction\(/u,
    name: "Transaction",
    question:
      "Must everything inside commit together, and is it short (no network or model calls inside)?",
    role: "engineering",
  },
  {
    files: /(?:^|\/)migrations\/.*\.sql$/u,
    line: /\b(?:DROP (?:TABLE|COLUMN)|SET NOT NULL|RENAME|ALTER COLUMN .* TYPE)\b|NOT NULL(?!.*DEFAULT)|CREATE (?:UNIQUE )?INDEX (?!CONCURRENTLY)/iu,
    name: "Migration",
    question:
      "Is it safe on production data while the old code still runs (existing rows, locks on large tables, deploy order)? Put any owner step in the PR's migration guide.",
    role: "engineering",
  },
  {
    files: /(?:^|\/)package\.json$/u,
    line: /^\s*"[@\w./-]+":\s*"(?:catalog:|workspace:|[~^]?\d)/u,
    name: "Dependency",
    question:
      "Is it needed (could existing code or an installed dependency do it)? Is it the latest stable, maintained, without install scripts? `pnpm audit --prod` must not gain an advisory.",
    role: "security",
  },
  {
    blocks: true,
    files: TESTS,
    line: /\.only(?:\.each)?\s*[(`]/u,
    name: "Focused test",
    question: "`.only` skips every other test in CI: remove it.",
    role: "engineering",
  },
  {
    files: CODE,
    // A disable that says why (`-- reason`, the repo's convention) has already answered.
    line: /oxlint-disable(?!.*\s--\s)|@ts-(?:ignore|expect-error|nocheck)|\bas unknown as\b|:\s*any\b|\.(?:skip|todo|fixme)\(/u,
    name: "Rule or test turned off",
    question: "Why can't the code satisfy the rule, the type or the test? Say it beside the line.",
    role: "engineering",
  },
  {
    files: SOURCE,
    line: /\bconsole\.(?:log|debug|info)\(|\bdebugger\b|\b(?:TODO|FIXME|XXX)\b/u,
    name: "Leftover",
    question: "Debug output or a note to finish later: remove it or do it now.",
    role: "engineering",
  },
];
