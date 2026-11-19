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
  const clean = (value: string) => value.replaceAll(/\s+/gu, " ").trim();

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

function items({ controls, texts }: Readable): ReadableItem[] {
  const named = new Set(controls);

  return [
    ...controls.map((text) => ({ context: "", kind: "control" as const, text })),
    ...texts
      .filter(({ text }) => !named.has(text))
      .map(({ context, text }) => ({
        context,
        kind: /\d/u.test(text) ? ("figure" as const) : ("text" as const),
        text,
      })),
  ];
}

function minus(from: ReadableItem[], taken: ReadableItem[]): ReadableItem[] {
  const left = new Map<string, number>();

  for (const item of taken) {
    const key = `${item.kind} ${item.text}`;
    left.set(key, (left.get(key) ?? 0) + 1);
  }

  return from.filter((item) => {
    const key = `${item.kind} ${item.text}`;
    const count = left.get(key) ?? 0;
    left.set(key, count - 1);
    return count <= 0;
  });
}

function ordered(list: ReadableItem[]) {
  return list.toSorted((first, second) => ORDER.indexOf(first.kind) - ORDER.indexOf(second.kind));
}

/**
 * What the base showed that the branch doesn't (`lost`), and the reverse (`gained`): numbers,
 * percentages, dates and counts first, with the line around them, then controls by name, then
 * other text. Leads to answer, not failures: removed on purpose, or a fault.
 */
export function readableChanges(base: Readable, branch: Readable) {
  const before = items(base);
  const after = items(branch);
  return { gained: ordered(minus(after, before)), lost: ordered(minus(before, after)) };
}

type Compared = { path: string; readable?: Readable; viewport: string };

const LISTED = 12;

function describe(item: ReadableItem) {
  const what = { control: "control", figure: "figure", text: "text" }[item.kind];
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
      const where = new Map<string, { item: ReadableItem; screens: string[] }>();

      for (const screen of screens) {
        for (const item of screen[side]) {
          const key = `${item.kind} ${item.text}`;
          const seen = where.get(key) ?? { item, screens: [] };
          seen.screens.push(screen.viewport);
          where.set(key, seen);
        }
      }

      const all = [...where.values()];

      return [
        ...all
          .slice(0, LISTED)
          .map(({ item, screens: on }) => `  - ${describe(item)} — ${on.join(", ")}`),
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
