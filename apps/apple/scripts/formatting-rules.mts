import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const FORMATTING_MODULE = "Features/Plan/PlanModels.swift";
export const FORMATTING_SEVERITY: "warning" | "error" = "warning";

const STYLE = "(?:dateTime|studyDay|relative|units|time|interval|components)";

const DIRECT_FORMAT = new RegExp(
  String.raw`\b(?:DateIntervalFormatter|DateFormatter|DateComponentsFormatter|RelativeDateTimeFormatter|MeasurementFormatter)\s*(?=[(.])|` +
    String.raw`\b(?:Date|Duration)\s*\.\s*(?:FormatStyle|VerbatimFormatStyle|UnitsFormatStyle|TimeFormatStyle)\b|` +
    String.raw`\.\s*formatted\s*\(\s*(?:\.${STYLE}\b|date\s*:)|` +
    String.raw`\bformat\s*:\s*\.${STYLE}\b|` +
    String.raw`\bText\s*\(\s*(?:timerInterval\s*:|[^,()]+,\s*style\s*:)|` +
    String.raw`\b(?:weekdaySymbols|shortWeekdaySymbols|veryShortWeekdaySymbols|standaloneWeekdaySymbols|shortStandaloneWeekdaySymbols|veryShortStandaloneWeekdaySymbols)\b|` +
    String.raw`\.\s*localizedName\s*\(\s*for\s*:|` +
    String.raw`\bString\s*\(\s*format\s*:`,
  "gu",
);

const DURATION_STRING =
  /%[\d$.]*[df]\s*(?:h|hr|hrs|hours?|min|mins|minutes?|s|sec|secs|seconds?)\b|%[\d$.]*d:%[\d$.]*d|^%[\d$.]*d\s*[–—-]\s*%[\d$.]*d$/u;

function isFormattingSite(match: RegExpExecArray, source: string): boolean {
  if (!match[0].startsWith("String")) {
    return true;
  }

  const literal = /^\s*"(?<value>(?:\\.|[^"\\])*)"/u.exec(
    source.slice(match.index + match[0].length),
  );

  return DURATION_STRING.test(literal?.groups?.value ?? "");
}

export function formattingViolations(source: string, file: string) {
  if (file === FORMATTING_MODULE) {
    return [];
  }

  const code = swiftCode(source);

  const scopes = dateStyleScopes(code);

  const direct = [...code.matchAll(DIRECT_FORMAT)]
    .filter((match) => isFormattingSite(match, source))
    .filter(
      (match) =>
        !scopes.some(
          (scope) =>
            match.index >= scope.start &&
            match.index < scope.body &&
            match[0].endsWith("FormatStyle") &&
            !/^\s*\(/u.test(code.slice(match.index + match[0].length)),
        ),
    )
    .map((match) => ({ call: match[0], index: match.index }));

  const typed = scopes.flatMap((scope) =>
    [...code.slice(scope.body, scope.end).matchAll(/\.\s*formatted\s*\(\s*(?<name>\w+)\s*\)/gu)]
      .filter((match) => scope.parameters.includes(match.groups?.name ?? ""))
      .map((match) => ({ call: match[0], index: scope.body + match.index })),
  );

  return [...direct, ...typed]
    .toSorted((a, b) => a.index - b.index)
    .map((match) => ({
      call: match.call.replaceAll(/\s+/gu, " "),
      file,
      line: code.slice(0, match.index).split("\n").length,
    }));
}

function dateStyleScopes(code: string) {
  return [...code.matchAll(/\bfunc\s+\w+\s*\((?<parameters>[^{}]*?)\)[^{]*\{/gu)]
    .map((match) => {
      const parameters = [
        ...(match.groups?.parameters ?? "").matchAll(
          /(?<name>\w+)\s*:\s*Date\s*\.\s*FormatStyle\b/gu,
        ),
      ].map((parameter) => parameter.groups?.name ?? "");

      const body = match.index + match[0].length;
      let depth = 1;
      let end = body;

      while (end < code.length && depth > 0) {
        if (code[end] === "{") {
          depth += 1;
        }

        if (code[end] === "}") {
          depth -= 1;
        }

        end += 1;
      }

      return { body, end, parameters, start: match.index };
    })
    .filter((scope) => scope.parameters.length > 0);
}

export async function scanFormatting(directory: string, relative = "") {
  const entries = await readdir(directory, { withFileTypes: true });

  const results = await Promise.all(
    entries.map(async (entry): Promise<ReturnType<typeof formattingViolations>> => {
      const file = path.posix.join(relative, entry.name);
      const full = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return scanFormatting(full, file);
      }

      return entry.name.endsWith(".swift")
        ? formattingViolations(await readFile(full, "utf8"), file)
        : [];
    }),
  );

  return results.flat().toSorted((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

// Preserve offsets and interpolation expressions while excluding comments and literal text.
function swiftCode(source: string): string {
  const output = source.split("");

  const hide = (start: number, end: number) => {
    for (let index = start; index < end; index += 1) {
      if (source[index] !== "\n") {
        output[index] = " ";
      }
    }
  };

  function stringAt(start: number, hashes: string): number {
    const opening = start + hashes.length;
    const quote = source.startsWith('"""', opening) ? '"""' : '"';
    const close = quote + hashes;
    hide(start, opening + quote.length);

    for (let index = opening + quote.length; index < source.length;) {
      if (source.startsWith(close, index)) {
        hide(index, index + close.length);
        return index + close.length;
      }

      if (source.startsWith(`\\${hashes}(`, index)) {
        const expression = index + hashes.length + 2;
        hide(index, expression);
        index = codeAt(expression, true);
      } else if (source.startsWith(`\\${hashes}`, index)) {
        const end = Math.min(source.length, index + hashes.length + 2);
        hide(index, end);
        index = end;
      } else {
        hide(index, index + 1);
        index += 1;
      }
    }

    return source.length;
  }

  function codeAt(start: number, interpolation = false): number {
    let depth = 0;

    for (let index = start; index < source.length;) {
      const rest = source.slice(index);

      if (rest.startsWith("//")) {
        const end = source.indexOf("\n", index);
        hide(index, end === -1 ? source.length : end);
        index = end === -1 ? source.length : end;
      } else if (rest.startsWith("/*")) {
        let end = index + 2;
        let comments = 1;

        while (end < source.length && comments > 0) {
          if (source.startsWith("/*", end)) {
            comments += 1;
            end += 2;
          } else if (source.startsWith("*/", end)) {
            comments -= 1;
            end += 2;
          } else {
            end += 1;
          }
        }

        hide(index, end);
        index = end;
      } else if (/^#*"/u.test(rest)) {
        index = stringAt(index, /^#*/u.exec(rest)?.[0] ?? "");
      } else {
        if (source[index] === "(") {
          depth += 1;
        }

        if (source[index] === ")") {
          if (interpolation && depth === 0) {
            return index + 1;
          }

          depth -= 1;
        }

        index += 1;
      }
    }

    return source.length;
  }

  codeAt(0);
  return output.join("");
}
