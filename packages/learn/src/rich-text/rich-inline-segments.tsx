import { useMathMarkup } from "#math-renderer";
import { Suspense } from "react";
import { DisplayMath } from "./display-math";
import { speakMath } from "./math-speech";
import { MathMarkupView } from "./spoken-math";
import { useMathWords } from "./use-spoken-text";

export type RichInlineSegment = (
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "displayMath"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "math"; text: string }
  | { kind: "text"; text: string }
) & { marked?: boolean };

type MathSegment = Extract<RichInlineSegment, { kind: "displayMath" | "math" }>;

function MathSource({ segment }: { segment: MathSegment }) {
  const words = useMathWords();

  return (
    <span>
      <span aria-hidden="true">{segment.text}</span>
      <span className="sr-only">{speakMath({ latex: segment.text, words })}</span>
    </span>
  );
}

function MathView({ segment }: { segment: MathSegment }) {
  const words = useMathWords();
  const markup = useMathMarkup({ displayMode: segment.kind === "displayMath", text: segment.text });

  if (markup === null) {
    return <MathSource segment={segment} />;
  }

  return <MathMarkupView markup={markup} words={speakMath({ latex: segment.text, words })} />;
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
    const formula = (
      <Suspense fallback={<MathSource segment={segment} />}>
        <MathView segment={segment} />
      </Suspense>
    );

    return segment.kind === "displayMath" ? <DisplayMath>{formula}</DisplayMath> : formula;
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

export type RichMarkStyle = "highlight" | "underline";

function MarkedRun({
  children,
  markStyle,
}: {
  children: React.ReactNode;
  markStyle: RichMarkStyle;
}) {
  if (markStyle === "underline") {
    return (
      <span className="hand-underline" data-slot="underline">
        {children}
      </span>
    );
  }

  return (
    <mark className="bg-warning/15 text-foreground rounded-[3px] box-decoration-clone px-0.5">
      {children}
    </mark>
  );
}

/** One element, so a flex parent wraps the text as one line instead of laying out each styled word. */
export function RichInlineSegments({
  markStyle = "highlight",
  segments,
}: {
  markStyle?: RichMarkStyle;
  segments: RichInlineSegment[];
}) {
  return (
    <span>
      {toRuns(segments).map((run) =>
        run.marked ? (
          <MarkedRun key={`mark-${run.start}`} markStyle={markStyle}>
            <SegmentViews segments={run.segments} start={run.start} />
          </MarkedRun>
        ) : (
          <SegmentViews key={`run-${run.start}`} segments={run.segments} start={run.start} />
        ),
      )}
    </span>
  );
}
