import { type CodeLanguageSpec, type CodeTokenKind, findCodeLanguage } from "./code-languages";

export type CodeToken = { kind: CodeTokenKind; text: string };

export function codeLineText(tokens: readonly CodeToken[]): string {
  return tokens.map((token) => token.text).join("");
}

const SPACE = /\s+/uy;
const PROPERTY_DOT = ".";

function matchAt(pattern: RegExp, code: string, index: number): string | null {
  pattern.lastIndex = index;
  return pattern.exec(code)?.[0] || null;
}

/** A name after a dot is a property (`console.log`, `user.type`), never a keyword. */
function wordKind({
  code,
  index,
  language,
  word,
}: {
  code: string;
  index: number;
  language: CodeLanguageSpec;
  word: string;
}): CodeTokenKind {
  const name = language.ignoreCase ? word.toLowerCase() : word;

  if (code[index - 1] === PROPERTY_DOT) {
    return "plain";
  }

  if (language.keywords.has(name)) {
    return "keyword";
  }

  return language.builtins.has(name) ? "builtin" : "plain";
}

function tokenAt(code: string, index: number, language: CodeLanguageSpec): CodeToken {
  const space = matchAt(SPACE, code, index);

  if (space) {
    return { kind: "plain", text: space };
  }

  const rule = language.rules
    .map((item) => ({ kind: item.kind, text: matchAt(item.pattern, code, index) }))
    .find((item) => item.text !== null);

  if (!rule?.text) {
    return { kind: "plain", text: code.charAt(index) };
  }

  return {
    kind: rule.kind === "word" ? wordKind({ code, index, language, word: rule.text }) : rule.kind,
    text: rule.text,
  };
}

function tokenize(code: string, language: CodeLanguageSpec): CodeToken[] {
  const tokens: CodeToken[] = [];
  const position = { index: 0 };

  while (position.index < code.length) {
    const token = tokenAt(code, position.index, language);
    const last = tokens.at(-1);

    if (last?.kind === token.kind) {
      last.text += token.text;
    } else {
      tokens.push(token);
    }

    position.index += token.text.length;
  }

  return tokens;
}

function splitLines(tokens: readonly CodeToken[]): CodeToken[][] {
  return tokens.reduce<CodeToken[][]>(
    (lines, token) => {
      const [first = "", ...rest] = token.text.split("\n");
      const last = lines.at(-1) ?? [];
      const current = first ? [...last, { kind: token.kind, text: first }] : last;

      return [
        ...lines.slice(0, -1),
        current,
        ...rest.map((text) => (text ? [{ kind: token.kind, text }] : [])),
      ];
    },
    [[]],
  );
}

/**
 * The program's lines, each as its colored runs, with every character kept as written. It scans
 * tokens without parsing the language, which is enough for the short programs lessons show; a
 * comment or string that spans lines colors each of them. `language` is a fence's name for it, or
 * null when it has none.
 */
export function highlightCode(code: string, language: string | null): CodeToken[][] {
  return splitLines(tokenize(code, findCodeLanguage(language)));
}
