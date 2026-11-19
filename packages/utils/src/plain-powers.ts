const WRITTEN = "0123456789+-−=()abcdefghijklmnoprstuvwxyz";
const RAISED = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ";

/** Every one is a single code unit; Unicode has no superscript q, so a power with one stays as written. */
const SUPERSCRIPTS = new Map(WRITTEN.split("").map((character, at) => [character, RAISED[at]]));

/**
 * A caret against what it raises, then the power: one in brackets or braces, or a sign and a run of
 * digits or of letters (`r^2`, `(1 + i)^n`, `10^-3`, `2^(n+1)`).
 */
const POWER =
  /(?<=[\p{L}\p{N})\]}])\^(?:\((?<parens>[^()]+)\)|\{(?<braces>[^{}]+)\}|(?<run>[-−]?(?:\p{N}+|\p{L}+)))/gu;

function toSuperscript(power: string): string | null {
  const characters = power.replaceAll(/\s/gu, "").split("");
  const raised = characters.map((character) => SUPERSCRIPTS.get(character));
  return raised.every(Boolean) ? raised.join("") : null;
}

/**
 * Text written to be read as is, such as a mind map's words, which its picture letters too: a power
 * written with a caret reads as the picture draws it, raised, the way the text already writes CO₂.
 */
export function superscriptPowers(text: string): string {
  return [...text.matchAll(POWER)].toReversed().reduce((result, match) => {
    const { braces, parens, run } = match.groups ?? {};
    const raised = toSuperscript(parens ?? braces ?? run ?? "");

    return raised === null
      ? result
      : `${result.slice(0, match.index)}${raised}${result.slice(match.index + match[0].length)}`;
  }, text);
}
