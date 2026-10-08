import { renderToString } from "katex";

/** A run of lesson text with one formatting primitive. */
export type RichInlineSegment =
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "displayMath"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "math"; text: string }
  | { kind: "text"; text: string };

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

/**
 * Renders parsed lesson text with only the primitives lessons use: LaTeX math, inline code and
 * bold or italic emphasis. Each text dialect has its own parser and shares this rendering.
 */
export function RichInlineSegments({ segments }: { segments: RichInlineSegment[] }) {
  return segments.map((segment, index) => {
    const key = `${segment.kind}-${index}`;

    return <RichInlineSegmentView key={key} segment={segment} />;
  });
}
