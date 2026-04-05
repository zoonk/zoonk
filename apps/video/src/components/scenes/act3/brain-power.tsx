import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { countUp, entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useT } from "@/lib/use-translations";
import { IconBrain } from "@tabler/icons-react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * "As you learn things" (instant, bold)
 * → "your Brain Power goes up." (word by word, muted)
 * → counter counting up with +10 badge.
 */
export function BrainPowerIntro() {
  const frame = useCurrentFrame();
  const t = useT();

  const counterStyle = entryScale({ frame, delay: 50, duration: 12 });
  const bpValue = countUp({ frame, startFrame: 55, endFrame: 85, from: 2440, to: 2450 });
  const badgeStyle = entryScale({ frame, delay: 55, duration: 10 });

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
        <SceneHeadline setup={t.brainIntroSetup} payoff={t.brainIntroPayoff} />

        {/* Brain Power counter */}
        <div style={{ ...counterStyle, display: "flex", alignItems: "center", gap: 12 }}>
          <IconBrain
            size={56}
            stroke={1.5}
            color={COLORS.text}
            style={{
              transform: `scale(${interpolate(frame, [55, 85], [0.4, 1.2], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.quad),
              })})`,
            }}
          />
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: COLORS.text,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {bpValue.toLocaleString()}
          </span>
          <span style={{ ...badgeStyle, fontSize: 24, fontWeight: 600, color: COLORS.bpGreen }}>
            +10
          </span>
        </div>
      </div>
    </SceneContainer>
  );
}

/**
 * "It never goes down." — standalone, bold, centered.
 * Short and punchy. The surprising fact gets its own screen.
 */
export function BrainPowerNeverDown() {
  const t = useT();

  return (
    <SceneContainer bg="white">
      <span style={{ fontSize: 48, fontWeight: 700, color: COLORS.text }}>
        {t.brainNeverSetup}
      </span>
    </SceneContainer>
  );
}

/**
 * "Because knowledge" (instant, bold)
 * → "is something nobody can take from you." (word by word, muted)
 */
export function BrainPowerPhilosophy() {
  const t = useT();

  return (
    <SceneContainer bg="white">
      <SceneHeadline setup={t.brainPhiloSetup} payoff={t.brainPhiloPayoff} fontSize={44} />
    </SceneContainer>
  );
}
