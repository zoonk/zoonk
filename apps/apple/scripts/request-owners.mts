/**
 * What `onDisappear` is given, from the modifier to the bracket that closes it: its closure, or its
 * `perform:` argument.
 */
function closureAt(lines: string[], start: number): string {
  let text = "";
  let depth = 0;
  let opened = false;

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const from = index === start ? line.indexOf(".onDisappear") : 0;

    for (const character of line.slice(from)) {
      text += character;

      if (character === "{" || character === "(") {
        depth += 1;
        opened = true;
      } else if (character === "}" || character === ")") {
        depth -= 1;
      }

      if (opened && depth === 0) {
        return text;
      }
    }

    text += " ";
  }

  return text;
}

/** What each `onDisappear` in one file ends: the receivers of its `cancel…()` and `leave(…)` calls. */
export function sitesIn(source: string, relative: string): string[] {
  const lines = source.split("\n");

  return counted(
    lines.flatMap((line, index) => {
      if (!line.includes(".onDisappear")) {
        return [];
      }

      const receivers = [
        ...closureAt(lines, index).matchAll(
          /(?<receiver>[\w?.]+?)\??\.(?:cancel\w*|leave)(?=\s*[()])/gu,
        ),
      ].map((match) => match.groups?.receiver ?? "");

      return receivers.length === 0
        ? []
        : [`${relative}: ${[...new Set(receivers)].toSorted().join(", ")}`];
    }),
  );
}

/** Each site once: a second site that ends the same things in one file is `… #2`, its own entry. */
function counted(keys: string[]): string[] {
  const seen = new Map<string, number>();

  return keys.map((key) => {
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? key : `${key} #${count}`;
  });
}

/** The text of the braces that open at `start`, without them. */
function bracesAt(source: string, start: number): string {
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start + 1, index);
      }
    }
  }

  return source.slice(start + 1);
}

/** The router calls each unkept `Task {}` in one file makes after its first `await`. */
export function looseRoutesIn(source: string, relative: string): string[] {
  return counted(
    [...source.matchAll(/^(?<before>[^\n]*?)\bTask\s*\{/gmu)].flatMap((match) => {
      if (/[=]|\breturn\b/u.test(match.groups?.before ?? "")) {
        return [];
      }

      const body = bracesAt(source, (match.index ?? 0) + match[0].length - 1);
      const awaited = body.indexOf("await");

      if (awaited === -1) {
        return [];
      }

      const routes = [...body.slice(awaited).matchAll(/\brouter\.(?<call>\w+)\(/gu)].map(
        (route) => `router.${route.groups?.call ?? ""}`,
      );

      return routes.length === 0
        ? []
        : [`${relative}: ${[...new Set(routes)].toSorted().join(", ")}`];
    }),
  );
}

function codeOnly(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"/gu, (text) =>
    text.replaceAll(/[^\n]/gu, " "),
  );
}

function bodies(
  source: string,
  pattern: RegExp,
): { name: string; start: number; end: number; body: string }[] {
  return [...source.matchAll(pattern)].map((match) => {
    const start = (match.index ?? 0) + match[0].length - 1;
    const body = bracesAt(source, start);
    return { body, end: start + body.length + 2, name: match.groups?.name ?? "", start };
  });
}

function requestWork(source: string, tasks: string[]): string {
  const functions = bodies(source, /\bfunc\s+(?<name>\w+)[^{]*\{/gu);

  const pending = tasks.flatMap((task) =>
    bodies(source, new RegExp(`\\b${task}\\s*=\\s*Task\\s*\\{`, "gu")),
  );

  const seen = new Set<string>();

  for (const region of pending) {
    for (const fn of functions) {
      const called = new RegExp(`\\b${fn.name}\\s*(?:\\(|\\{)`, "u").test(region.body);
      const contains = fn.start < region.start && fn.end >= region.end;

      if (!seen.has(fn.name) && (called || contains)) {
        seen.add(fn.name);
        pending.push(fn, ...bodies(source, new RegExp(`\\b${fn.name}\\s*\\{`, "gu")));
      }
    }
  }

  return pending.map((region) => region.body).join("\n");
}

function assignedIn(source: string, name: string): boolean {
  return new RegExp(`(?<![.\\w])${name}\\s*=(?!=)|\\bself\\.${name}\\s*=(?!=)`, "u").test(source);
}

function failureWork(source: string): string {
  const catches = bodies(source, /\bcatch[^{]*\{/gu).map((region) => region.body);

  const cases = [...source.matchAll(/\bcase\s+[^:\n]*\.(?:failed|refused)[^:\n]*:/gu)].map(
    (match) => {
      const rest = source.slice((match.index ?? 0) + match[0].length);
      return rest.split(/\bcase\b|\bdefault:|^\s*\}/mu)[0] ?? "";
    },
  );

  const conditional = bodies(source, /\bif\s+case\s+\.(?:failed|refused)[^{]*\{/gu).map(
    (region) => region.body,
  );

  return [...catches, ...cases, ...conditional].join("\n");
}

export function screenFailuresIn(source: string, relative: string): string[] {
  const code = codeOnly(source);
  const structs = bodies(code, /\bstruct\s+(?<name>\w+)[^{]*\{/gu);

  return structs.flatMap((view) => {
    let own = view.body;

    for (const nested of structs
      .filter((item) => item.start > view.start && item.end < view.end)
      .toReversed()) {
      const start = nested.start - view.start - 1;

      own =
        own.slice(0, start) +
        " ".repeat(nested.end - nested.start) +
        own.slice(nested.end - view.start - 1);
    }

    const state = [
      ...own.matchAll(
        /@State\s+(?:(?:private|fileprivate|internal|public)(?:\(set\))?\s+)?var\s+(?<name>\w+)(?<declaration>[^\n]*)/gu,
      ),
    ];

    const tasks = state
      .filter((field) => /:\s*Task\s*</u.test(field.groups?.declaration ?? ""))
      .map((field) => field.groups?.name ?? "");

    const work = requestWork(own, tasks);

    const failure = failureWork(work);

    const failures = state.filter((field) => {
      const name = field.groups?.name ?? "";
      const declaration = field.groups?.declaration ?? "";

      return (
        assignedIn(work, name) &&
        (/:[^=\n]*\b[\w.]*(?:Error|Failure)\??/u.test(declaration) || assignedIn(failure, name))
      );
    });

    return failures.length > 0 ? [`${relative}: ${view.name}`] : [];
  });
}
