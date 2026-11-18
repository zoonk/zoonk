const CONTINUATION_ARROW =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>';

// One arrow per extra row a wrapped line takes, under its number.
const CONTINUATION_MARKS = {
  maskImage: `url("data:image/svg+xml,${encodeURIComponent(CONTINUATION_ARROW)}")`,
  maskPosition: "right top",
  maskRepeat: "repeat-y",
  maskSize: "0.75em 1lh",
} satisfies React.CSSProperties;

export function CodeLineNumber({ number, style }: { number: number; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground col-start-1 flex flex-col self-stretch pr-3 text-right tabular-nums select-none"
      style={style}
    >
      {number}
      <span className="flex-1 bg-current" style={CONTINUATION_MARKS} />
    </span>
  );
}
