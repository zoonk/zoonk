import { renderToString } from "katex";

/**
 * A run of lesson text with one formatting primitive. `marked` runs are a sentence the screen
 * points at, such as the one a question rests on, read again after a wrong answer.
 */
export type RichInlineSegment = (
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "displayMath"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "math"; text: string }
  | { kind: "text"; text: string }
) & { marked?: boolean };

/**
 * Some structured AI responses include JSON-escaped LaTeX commands as literal
 * learner text, such as `\\rightarrow`. KaTeX expects `\rightarrow`, so the
 * player accepts that common over-escaped shape at render time.
 */
function normalizeLatexCommands(text: string) {
  return text.replaceAll(/\\\\[A-Za-z]+/gu, (escapedCommand) => escapedCommand.slice(1));
}

/**
 * Renders LaTeX through KaTeX with errors kept inline. AI-generated formulas
 * should never crash the player, and visible fallback text makes bad formulas
 * reviewable instead of invisible.
 */
function renderMathToHtml({ displayMode, text }: { displayMode: boolean; text: string }) {
  return renderToString(normalizeLatexCommands(text), {
    displayMode,
    output: "mathml",
    throwOnError: false,
    trust: false,
  });
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
      <code className="bg-foreground text-background rounded-sm px-1 py-0.5 font-mono text-[0.85em]">
        {segment.text}
      </code>
    );
  }

  if (segment.kind === "math" || segment.kind === "displayMath") {
    return (
      <span
        className={segment.kind === "displayMath" ? "my-3 block overflow-x-auto" : undefined}
        // eslint-disable-next-line react/no-danger -- KaTeX returns escaped MathML with trust disabled, which lets formulas render without allowing AI-provided HTML.
        dangerouslySetInnerHTML={{
          __html: renderMathToHtml({
            displayMode: segment.kind === "displayMath",
            text: segment.text,
          }),
        }}
      />
    );
  }

  return <span>{segment.text}</span>;
}

type SegmentRun = { marked: boolean; segments: RichInlineSegment[]; start: number };

/** Consecutive segments grouped by whether they're marked, so one mark spans a whole sentence. */
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

/**
 * Renders parsed lesson text with only the primitives lessons use: LaTeX math, inline code and
 * bold or italic emphasis, with a marked sentence highlighted. Each text dialect has its own
 * parser and shares this rendering.
 */
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
