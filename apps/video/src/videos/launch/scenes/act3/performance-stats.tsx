import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { countUp, entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useCurrentFrame } from "remotion";
import { useT } from "../../use-translations";

/**
 * "Zoonk tracks your learning patterns" (instant, bold)
 * → "so you always know what works." (word by word, muted)
 *
 * Introduces the concept before showing data.
 */
export function PatternsIntro() {
  const t = useT();

  return (
    <SceneContainer bg="white">
      <SceneHeadline setup={t.patternsSetup} payoff={t.patternsPayoff} fontSize={40} />
    </SceneContainer>
  );
}

/**
 * "YOUR LEARNING PATTERNS" label + two hero stats.
 * Data only — no philosophical text. Let the numbers speak.
 */
export function PatternsData() {
  const frame = useCurrentFrame();
  const t = useT();

  const leftStatStyle = entryScale({ frame, delay: 8, duration: 12 });
  const rightStatStyle = entryScale({ frame, delay: 14, duration: 12 });

  const accuracy = countUp({ frame, startFrame: 18, endFrame: 55, from: 0, to: 87 });

  return (
    <SceneContainer bg="white">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Two hero stats side by side */}
        <div style={{ display: "flex", gap: 80, alignItems: "flex-start" }}>
          <div
            style={{
              ...leftStatStyle,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 700, color: COLORS.text }}>
              {t.patternsFocusTime}
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.muted }}>
              {t.patternsFocusLabel}
            </span>
          </div>

          <div
            style={{
              ...rightStatStyle,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: COLORS.bpGreen,
                fontVariantNumeric: "tabular-nums",
                minWidth: 120,
                textAlign: "center",
              }}
            >
              {accuracy}%
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.muted }}>
              {t.patternsAccuracyLabel}
            </span>
          </div>
        </div>
      </div>
    </SceneContainer>
  );
}

/**
 * "Know when you learn best," (instant, bold)
 * → "so you can be more productive." (word by word, muted)
 *
 * The "so what" — connects the data to the viewer's life.
 */
export function PatternsPayoff() {
  const t = useT();

  return (
    <SceneContainer bg="white">
      <SceneHeadline
        setup={t.patternsWhySetup}
        payoff={t.patternsWhyPayoff}
        payoffStartFrame={20}
        fontSize={40}
      />
    </SceneContainer>
  );
}
