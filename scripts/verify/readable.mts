/* oxlint-disable max-lines-per-function, unicorn/consistent-function-scoping, unicorn/prefer-dom-node-text-content -- The probe is sent to the page as one function, so its helpers live inside it (`probe.mts`), and it reads what shows (`innerText`), not hidden text. */

/**
 * What a learner can read on a screen: each visible text (its outermost element with text of its
 * own, as one string), with the nearest line around it for a figure, and the name of each control.
 */
export type Readable = { controls: string[]; texts: { context: string; text: string }[] };

export function readReadable(): Readable {
  const LONGEST = 200;
  const CONTEXT = 100;

  const CONTROLS =
    "button, a[href], [role=button], [role=link], [role=tab], [role=menuitem], summary";

  const { label, shown } = globalThis.zoonkPage;
  // An SVG's `parentElement` is typed as HTML but has no `innerText`.
  const clean = (value: string | undefined) => (value ?? "").replaceAll(/\s+/gu, " ").trim();

  function ownText(element: Element) {
    return clean(
      [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(" "),
    );
  }

  function visible(element: Element) {
    return (
      shown(element) && !element.closest("script, style, noscript, [aria-hidden=true], [inert]")
    );
  }

  const taken: Element[] = [];
  const texts: Readable["texts"] = [];

  const readable = [...document.body.querySelectorAll("*")].filter(
    (element) => ownText(element) && visible(element),
  );

  for (const element of readable) {
    if (taken.some((outer) => outer.contains(element))) {
      // oxlint-disable-next-line no-continue -- Inside a text already read whole.
      continue;
    }

    const whole = element instanceof HTMLElement ? clean(element.innerText) : ownText(element);
    const text = whole.length > LONGEST ? ownText(element) : whole;

    if (whole.length <= LONGEST) {
      taken.push(element);
    }

    // A figure's label is the nearest line around it: "70%" in "Last mock 70% Score in mock 1".
    let context = "";

    for (
      let parent = element.parentElement;
      parent && /\d/u.test(text) && !context;
      parent = parent.parentElement
    ) {
      const around = clean(parent.innerText);

      if (around.length > CONTEXT) {
        break;
      }

      context = around === text ? "" : around;
    }

    texts.push({ context, text });
  }

  const controls = [...document.body.querySelectorAll(CONTROLS)]
    .filter((element) => visible(element))
    .map((element) => clean(label(element)))
    .filter(Boolean);

  return { controls, texts };
}

export type ReadableItem = { context: string; kind: "control" | "figure" | "text"; text: string };

const ORDER: ReadableItem["kind"][] = ["figure", "control", "text"];

/** A number as it's read: "70%", "13:30", "1,200", "2027". */
const FIGURE = /\d+(?:[.,:]\d+)*\s?%?/gu;

/**
 * A figure is each number a screen shows, compared as a number, so one that's still there in
 * reworded text ("45 questions" for "45 perguntas") isn't lost; it's shown with the text it was in.
 * Text and controls are compared whole.
 */
function items({ controls, texts }: Readable): ReadableItem[] {
  const named = new Set(controls);

  return [
    ...texts.flatMap(({ context, text }) =>
      [...text.matchAll(FIGURE)].map(([figure]) => ({
        context: context || text,
        kind: "figure" as const,
        text: figure.replaceAll(/\s/gu, ""),
      })),
    ),
    ...controls.map((text) => ({ context: "", kind: "control" as const, text })),
    // A text that is only a number ("70%") is compared as that number alone.
    ...texts
      .filter(({ text }) => !named.has(text) && /\p{L}/u.test(text.replaceAll(FIGURE, "")))
      .map(({ text }) => ({ context: "", kind: "text" as const, text })),
  ];
}

function alike(first: string, second: string) {
  const words = (line: string) =>
    new Set(
      line
        .toLowerCase()
        .split(/[^\p{L}\p{N}%]+/u)
        .filter(Boolean),
    );

  const [one, two] = [words(first), words(second)];
  const shared = [...one].filter((word) => two.has(word)).length;
  return shared / Math.max(one.size + two.size - shared, 1);
}

/**
 * What `from` has that `taken` doesn't, counting repeats. Equal items pair up by how alike their
 * lines are, so when one of two "1"s goes missing, the one listed is the one whose line went
 * ("Score in mock 1"), not the first one read ("Day 1").
 */
function minus(from: ReadableItem[], taken: ReadableItem[]): ReadableItem[] {
  const key = (item: ReadableItem) => `${item.kind} ${item.text}`;
  const others = Map.groupBy(taken, key);
  const paired = new Set<ReadableItem>();

  for (const [name, mine] of Map.groupBy(from, key)) {
    const theirs = others.get(name) ?? [];

    const pairs = mine
      .flatMap((item) =>
        theirs.map((other) => ({ item, other, score: alike(item.context, other.context) })),
      )
      .toSorted((first, second) => second.score - first.score);

    const used = new Set<ReadableItem>();

    for (const { item, other } of pairs) {
      if (!paired.has(item) && !used.has(other)) {
        paired.add(item);
        used.add(other);
      }
    }
  }

  return from.filter((item) => !paired.has(item));
}

function ordered(list: ReadableItem[]) {
  return list.toSorted((first, second) => ORDER.indexOf(first.kind) - ORDER.indexOf(second.kind));
}

/**
 * What the base showed that the branch doesn't (`lost`), and the reverse (`gained`): numbers
 * (scores, percentages, dates, counts) first, each with the line it was in, then controls by name,
 * then other text. Leads to answer, not failures: removed on purpose, or a fault.
 */
export function readableChanges(base: Readable, branch: Readable) {
  const before = items(base);
  const after = items(branch);
  return { gained: ordered(minus(after, before)), lost: ordered(minus(before, after)) };
}

type Compared = { path: string; readable?: Readable; viewport: string };

const LISTED = 12;

function describe(item: ReadableItem) {
  const what = { control: "control", figure: "number", text: "text" }[item.kind];
  const around = item.context ? ` (in "${item.context}")` : "";
  return `${what} "${item.text}"${around}`;
}

/** The report's section: per page, what a learner could read on the base and can't on the branch, then the reverse, each with the screens it showed on. */
export function readableSection(baseline: Compared[], loads: Compared[]): string[] {
  const before = new Map(baseline.map((load) => [`${load.path} ${load.viewport}`, load]));

  const pages = Map.groupBy(
    loads.flatMap((load) => {
      const base = before.get(`${load.path} ${load.viewport}`)?.readable;
      return base && load.readable ? [{ ...load, ...readableChanges(base, load.readable) }] : [];
    }),
    (load) => load.path,
  );

  const lines = [...pages].flatMap(([path, screens]) => {
    const list = (side: "gained" | "lost") => {
      const where = new Map<string, { count: number; item: ReadableItem; screens: string[] }>();

      for (const screen of screens) {
        for (const item of screen[side]) {
          const key = `${item.kind} ${item.text}`;
          const seen = where.get(key) ?? { count: 0, item, screens: [] };

          if (!seen.screens.includes(screen.viewport)) {
            seen.screens.push(screen.viewport);
          }

          seen.count = Math.max(
            seen.count,
            screen[side].filter((other) => `${other.kind} ${other.text}` === key).length,
          );

          where.set(key, seen);
        }
      }

      const all = [...where.values()];

      return [
        ...all
          .slice(0, LISTED)
          .map(
            ({ count, item, screens: on }) =>
              `  - ${describe(item)}${count > 1 ? ` ×${count}` : ""} — ${on.join(", ")}`,
          ),
        ...(all.length > LISTED ? [`  - and ${all.length - LISTED} more`] : []),
      ];
    };

    const lost = list("lost");
    const gained = list("gained");

    if (lost.length === 0 && gained.length === 0) {
      return [];
    }

    return [
      `- **${path}**`,
      ...(lost.length > 0
        ? ["  - On the base, not on the branch:", ...lost.map((line) => `  ${line}`)]
        : []),
      ...(gained.length > 0
        ? ["  - On the branch, not on the base:", ...gained.map((line) => `  ${line}`)]
        : []),
    ];
  });

  const unread = baseline.length > 0 && baseline.every((load) => !load.readable);

  return [
    "## What a learner reads, compared with the baseline",
    "",
    unread
      ? "The baseline run didn't record what each screen says: measure the base again with this checkout's `verify:pages` (`--checkout` for another checkout's server)."
      : 'Leads, not failures: answer each in the PR as removed on purpose, or fix it. Figures (numbers, percentages, dates, counts) come first with the line around them, then controls by name, then other text. Text that changes with the clock (today\'s date, "2 min ago") shows up here too when the two runs were taken apart.',
    "",
    ...(lines.length > 0 || unread ? lines : ["Every page says the same on both."]),
    "",
  ];
}
