/** Japanese and Korean characters are about two of Geist Mono's figures wide. */
const WIDE_CHARACTERS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

function monoWidth(text: string): number {
  return text.length + (text.match(WIDE_CHARACTERS)?.length ?? 0);
}

/** The room, in `ch`, that fits the widest of a list's times. */
export function getRowTimeRoom(times: readonly string[]): number {
  return Math.max(0, ...times.map((time) => monoWidth(time)));
}
