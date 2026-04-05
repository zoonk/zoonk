import { wordByWordTimings, wordOpacity } from "@/lib/animation";
import { type CSSProperties } from "react";
import { useCurrentFrame } from "remotion";

/**
 * Renders text word by word with variable timing that mimics
 * natural speech rhythm. Each word fades in over 3 frames.
 *
 * Used for payoff lines that build suspense after a hard-cut setup line.
 */
export function WordReveal({
  text,
  startFrame,
  style,
}: {
  text: string;
  startFrame: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const words = wordByWordTimings({ text, startFrame });

  return (
    <span style={{ ...style, display: "inline-flex", flexWrap: "wrap", gap: "0 0.3em" }}>
      {words.map(({ word, startFrame: wordStart }, i) => (
        <span key={i} style={{ opacity: wordOpacity({ frame, wordStartFrame: wordStart }) }}>
          {word}
        </span>
      ))}
    </span>
  );
}
