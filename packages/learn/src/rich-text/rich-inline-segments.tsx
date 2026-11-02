import { useMathMarkup } from "#math-renderer";
import { Suspense } from "react";

export type RichInlineSegment = (
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "displayMath"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "math"; text: string }
  | { kind: "text"; text: string }
) & { marked?: boolean };

type MathSegment = Extract<RichInlineSegment, { kind: "displayMath" | "math" }>;

function mathClassName(segment: MathSegment) {
  return segment.kind === "displayMath" ? "my-3 block overflow-x-auto" : undefined;
}

function MathSource({ segment }: { segment: MathSegment }) {
  return <span className={mathClassName(segment)}>{segment.text}</span>;
}

function MathView({ segment }: { segment: MathSegment }) {
  const markup = useMathMarkup({ displayMode: segment.kind === "displayMath", text: segment.text });

  if (markup === null) {
    return <MathSource segment={segment} />;
  }

  return (
    <span
      className={mathClassName(segment)}
      // eslint-disable-next-line react/no-danger -- KaTeX returns escaped MathML with trust disabled, which lets formulas render without allowing AI-provided HTML.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function RichInlineSegmentView({ segment }: { segment: RichInlineSegment }) {
  if (segment.kind === "bold") {
    return <strong>{segment.text}</strong>;
  }

  if (segment.kind === "italic") {
    return <em>{segment.text}</em>;
  }

  if (segment.kind === "code") {
    return (
      <code className="bg-muted text-foreground rounded-sm px-1 py-0.5 font-mono text-[0.85em]">
        {segment.text}
      </code>
    );
  }

  if (segment.kind === "math" || segment.kind === "displayMath") {
    // Its own boundary, so hydration keeps the server's drawing while KaTeX loads.
    return (
      <Suspense fallback={<MathSource segment={segment} />}>
        <MathView segment={segment} />
      </Suspense>
    );
  }

  return <span>{segment.text}</span>;
}

type SegmentRun = { marked: boolean; segments: RichInlineSegment[]; start: number };

function toRuns(segments: RichInlineSegment[]): SegmentRun[] {
  return segments.reduce<SegmentRun[]>((runs, segment, index) => {
    const marked = segment.marked === true;
    const last = runs.at(-1);

    return last?.marked === marked
      ? [...runs.slice(0, -1), { ...last, segments: [...last.segments, segment] }]
      : [...runs, { marked, segments: [segment], start: index }];
  }, []);
}

function SegmentViews({ segments, start }: { segments: RichInlineSegment[]; start: number }) {
  return segments.map((segment, index) => {
    const key = `${segment.kind}-${start + index}`;

    return <RichInlineSegmentView key={key} segment={segment} />;
  });
}

export function RichInlineSegments({ segments }: { segments: RichInlineSegment[] }) {
  return toRuns(segments).map((run) =>
    run.marked ? (
      <mark
        className="bg-warning/15 text-foreground rounded-[3px] box-decoration-clone px-0.5"
        key={`mark-${run.start}`}
      >
        <SegmentViews segments={run.segments} start={run.start} />
      </mark>
    ) : (
      <SegmentViews key={`run-${run.start}`} segments={run.segments} start={run.start} />
    ),
  );
}
