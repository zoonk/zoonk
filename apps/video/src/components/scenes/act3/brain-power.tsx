import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { countUp, entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useT } from "@/lib/use-translations";
import { useCurrentFrame } from "remotion";

/**
 * "As you learn things" (instant, bold)
 * → "your Brain Power increases." (word by word, muted)
 * → counter counting up with +10 badge.
 *
 * The "what is it" scene — introduces the concept with a tangible counter.
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
        <SceneHeadline
          setup={t.brainIntroSetup}
          payoff={t.brainIntroPayoff}
        />

        {/* Brain Power counter */}
        <div style={{ ...counterStyle, display: "flex", alignItems: "baseline", gap: 12 }}>
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
 * "Your Brain Power never goes down." (instant, bold)
 * → "It only goes up." (word by word, muted)
 *
 * Short, punchy. The surprising fact.
 */
export function BrainPowerNeverDown() {
  const t = useT();

  return (
    <SceneContainer bg="white">
      <SceneHeadline
        setup={t.brainNeverSetup}
        payoff={t.brainNeverPayoff}
        payoffStartFrame={20}
        fontSize={44}
      />
    </SceneContainer>
  );
}

/**
 * "Because knowledge" (instant, bold)
 * → "is something nobody can take from you." (word by word, muted)
 *
 * The emotional payoff. The "because" connects back to the previous scene.
 */
export function BrainPowerPhilosophy() {
  const t = useT();

  return (
    <SceneContainer bg="white">
      <SceneHeadline
        setup={t.brainPhiloSetup}
        payoff={t.brainPhiloPayoff}
        fontSize={44}
      />
    </SceneContainer>
  );
}
