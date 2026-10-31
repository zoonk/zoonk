import { type Lookup, type Mode, parseCss, resolveColor, toArgbHex, tokensAt } from "./palette.mts";

/** Main's `[data-subject]` roles, which each subject's hue and chroma fill in. */
const SUBJECT_TOKENS = ["subject", "subject-text", "subject-tint"] as const;

const SUBJECT_PRELUDE = /^\[data-subject="(?<subject>[\w-]+)"\]$/u;
const CALC_PRODUCT = /calc\(\s*(?<left>[\d.]+)\s*\*\s*(?<right>[\d.]+)\s*\)/gu;

function fillSubject(value: string, subject: Map<string, string>): string {
  const filled = value.replaceAll(
    /var\(--(?<name>subject-hue|subject-chroma)\)/gu,
    (match, name: string) => subject.get(name) ?? match,
  );

  return filled.replaceAll(CALC_PRODUCT, (_match, left: string, right: string) =>
    String(Number(left) * Number(right)),
  );
}

/**
 * Every subject's roles per mode, cascaded as the browser does: the shared formulas (dark and more
 * contrast override them), then the subject's own hue and chroma.
 */
export function readSubjects(globalsCss: string): Map<string, Record<Mode, Map<string, string>>> {
  const root = parseCss(globalsCss);
  const base = tokensAt(root, ["[data-subject]"]);
  const dark = new Map([...base, ...tokensAt(root, ["[data-subject]", "@variant dark"])]);
  const moreContrast = tokensAt(root, ["[data-subject]", "@media (prefers-contrast: more)"]);

  const formulas: Record<Mode, Map<string, string>> = {
    dark,
    darkMoreContrast: new Map([
      ...dark,
      ...moreContrast,
      ...tokensAt(root, ["[data-subject]", "@media (prefers-contrast: more)", "@variant dark"]),
    ]),
    light: base,
    lightMoreContrast: new Map([...base, ...moreContrast]),
  };

  const subjects = new Map<string, Record<Mode, Map<string, string>>>();

  for (const block of root.children) {
    const name = SUBJECT_PRELUDE.exec(block.prelude)?.groups?.subject;

    if (name) {
      const own = new Map([...base, ...block.declarations]);

      const fill = (mode: Map<string, string>) =>
        new Map(
          SUBJECT_TOKENS.map((token) => [token, fillSubject(mode.get(token) ?? "", own)] as const),
        );

      subjects.set(name, {
        dark: fill(formulas.dark),
        darkMoreContrast: fill(formulas.darkMoreContrast),
        light: fill(formulas.light),
        lightMoreContrast: fill(formulas.lightMoreContrast),
      });
    }
  }

  return subjects;
}

/** A subject's roles in one mode, laid on that mode's background like every other role. */
export function subjectPalette({
  subject,
  ...lookup
}: Lookup & { subject: Map<string, string> }): Map<string, string> {
  const tokens = new Map([...lookup.tokens, ...subject]);

  return new Map(
    SUBJECT_TOKENS.map((token) => [
      token,
      toArgbHex(resolveColor({ name: token, palette: lookup.palette, tokens })),
    ]),
  );
}
