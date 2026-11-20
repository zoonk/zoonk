/**
 * Where a wrapped line of code reads best when it splits: before a `.`, after an opening bracket or
 * a comma, never inside an empty pair (`()`).
 */
const BREAK_POINTS = /(?=\.)|(?<=[(,[{])(?![)\]}])/u;

export function withBreakPoints(text: string): React.ReactNode[] {
  return text.split(BREAK_POINTS).flatMap((part, index) => {
    const key = `${index}:${part}`;
    return index === 0 ? [part] : [<wbr key={key} />, part];
  });
}
