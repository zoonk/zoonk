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

/** Whether a wrapped line may split where one run of code ends and the next begins. */
export function breaksBetween(before: string, after: string): boolean {
  return before !== "" && `${before.slice(-1)}${after.charAt(0)}`.split(BREAK_POINTS).length > 1;
}
