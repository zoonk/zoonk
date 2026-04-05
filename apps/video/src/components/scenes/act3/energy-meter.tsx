import { SceneContainer } from "@/components/scene-container";
import { SceneHeadline } from "@/components/scene-headline";
import { entryScale } from "@/lib/animation";
import { COLORS } from "@/lib/constants";
import { useT } from "@/lib/use-translations";
import { Easing, interpolate, useCurrentFrame } from "remotion";

const ARC_CIRCUMFERENCE = Math.PI * 64;

/**
 * "Every correct answer" (instant, bold)
 * → "fills your energy bar." (word by word, muted)
 * → small gauge filling up.
 *
 * Establishes the mechanic — energy is tied to performance.
 */
export function EnergyIntro() {
  const frame = useCurrentFrame();
  const t = useT();

  const gaugeStyle = entryScale({ frame, delay: 45, duration: 12 });
  const energyValue = interpolate(frame, [50, 70], [60, 78], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const arcDashoffset = ARC_CIRCUMFERENCE * (1 - energyValue / 100);

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
        <SceneHeadline setup={t.energySetup} payoff={t.energyPayoff} fontSize={44} />

        <div style={{ ...gaugeStyle, position: "relative", width: 140, height: 88 }}>
          <svg width={140} height={88} viewBox="0 0 140 88">
            <path
              d="M 14 74 A 56 56 0 0 1 126 74"
              fill="none"
              stroke={COLORS.border}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <path
              d="M 14 74 A 56 56 0 0 1 126 74"
              fill="none"
              stroke={COLORS.energy}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={ARC_CIRCUMFERENCE}
              strokeDashoffset={arcDashoffset}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: COLORS.energy,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(energyValue)}
            </span>
          </div>
        </div>
      </div>
    </SceneContainer>
  );
}

/**
 * "Miss a day?" (instant, bold)
 * → "It dips. Just a little." (word by word, muted)
 * → gauge dipping slightly.
 *
 * Now that the viewer knows what energy is, the dip has meaning.
 */
export function EnergyDip() {
  const frame = useCurrentFrame();
  const t = useT();

  const gaugeStyle = entryScale({ frame, delay: 45, duration: 12 });
  const energyValue = interpolate(frame, [50, 70], [78, 74], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const arcDashoffset = ARC_CIRCUMFERENCE * (1 - energyValue / 100);

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
        <SceneHeadline setup={t.energyDipSetup} payoff={t.energyDipPayoff} fontSize={44} />

        <div style={{ ...gaugeStyle, position: "relative", width: 140, height: 88 }}>
          <svg width={140} height={88} viewBox="0 0 140 88">
            <path
              d="M 14 74 A 56 56 0 0 1 126 74"
              fill="none"
              stroke={COLORS.border}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <path
              d="M 14 74 A 56 56 0 0 1 126 74"
              fill="none"
              stroke={COLORS.energy}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={ARC_CIRCUMFERENCE}
              strokeDashoffset={arcDashoffset}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: COLORS.energy,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(energyValue)}
            </span>
          </div>
        </div>
      </div>
    </SceneContainer>
  );
}

/**
 * "Life is messy." (instant, bold)
 * → "Your energy always recovers." (word by word, muted)
 *
 * The emotional payoff — the differentiator. Text only.
 */
export function EnergyRecovers() {
  const t = useT();

  return (
    <SceneContainer bg="white">
      <SceneHeadline setup={t.energyRecoversSetup} payoff={t.energyRecoversPayoff} fontSize={44} />
    </SceneContainer>
  );
}
