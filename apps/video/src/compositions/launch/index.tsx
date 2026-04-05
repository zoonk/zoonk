import { SearchPrompt } from "@/components/scenes/act1/search-prompt";
import { StatusQuo } from "@/components/scenes/act1/status-quo";
import { TypographyMoment1 } from "@/components/scenes/act1/typography-moment-1";
import { ZoonkCard } from "@/components/scenes/act1/zoonk-card";
import { FillInBlank } from "@/components/scenes/act2/fill-in-blank";
import { NodeDiagram } from "@/components/scenes/act2/node-diagram";
import { StoryBranch } from "@/components/scenes/act2/story-branch";
import { Timeline } from "@/components/scenes/act2/timeline";
import { TypographyMoment2 } from "@/components/scenes/act2/typography-moment-2";
import { BrainPowerBelt } from "@/components/scenes/act3/brain-power-belt";
import { ClosingWords } from "@/components/scenes/act3/closing-words";
import { EnergyMeter } from "@/components/scenes/act3/energy-meter";
import { Logo } from "@/components/scenes/act3/logo";
import { MultiLanguageFlash } from "@/components/scenes/act3/multi-language-flash";
import { PerformanceStats } from "@/components/scenes/act3/performance-stats";
import { TheBreath } from "@/components/scenes/act3/the-breath";
import { ACT_TRANSITION_FRAMES, SCENES, TRANSITION_FRAMES } from "@/lib/constants";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, Audio, interpolate, staticFile, useVideoConfig } from "remotion";
import { type LaunchVideoProps } from "./schema";

/**
 * 60-second launch video for Zoonk.
 *
 * Apple-style: isolated UI elements on alternating black/white backgrounds.
 * No phone frames, no full UI screenshots. Each scene shows one focused element.
 *
 * NARRATIVE ARC:
 * ACT 1: THE SPARK (0:00-0:12) — "Wait, I can type anything?" -> "Oh, I understood that."
 * ACT 2: THE PROOF (0:12-0:38) — "Look at all the ways this teaches."
 * ACT 3: THE FEELING (0:38-1:00) — "This respects me." -> "I can do this."
 */
export function LaunchVideo(_props: LaunchVideoProps) {
  const { fps, durationInFrames } = useVideoConfig();

  const standardTransition = (
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
    />
  );

  const actTransition = (
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: ACT_TRANSITION_FRAMES })}
    />
  );

  return (
    <AbsoluteFill>
      {/* Background music — fades in over 2s, out over 3s */}
      <Audio
        src={staticFile("audio/background.mp3")}
        volume={(f) => {
          const fadeIn = interpolate(f, [0, 2 * fps], [0, 0.2], {
            extrapolateRight: "clamp",
          });
          const fadeOut = interpolate(f, [durationInFrames - 3 * fps, durationInFrames], [0.2, 0], {
            extrapolateLeft: "clamp",
          });
          return Math.min(fadeIn, fadeOut);
        }}
      />

      <TransitionSeries>
        {/* ─── ACT 1: THE SPARK ─── */}

        <TransitionSeries.Sequence durationInFrames={SCENES.searchPrompt}>
          <SearchPrompt />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.typographyMoment1}>
          <TypographyMoment1 />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.statusQuo}>
          <StatusQuo />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.zoonkCard}>
          <ZoonkCard />
        </TransitionSeries.Sequence>

        {/* Act boundary — slightly longer fade */}
        {actTransition}

        {/* ─── ACT 2: THE PROOF ─── */}

        <TransitionSeries.Sequence durationInFrames={SCENES.timeline}>
          <Timeline />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.fillInBlank}>
          <FillInBlank />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.nodeDiagram}>
          <NodeDiagram />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.storyBranch}>
          <StoryBranch />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.typographyMoment2}>
          <TypographyMoment2 />
        </TransitionSeries.Sequence>

        {/* Act boundary — slightly longer fade */}
        {actTransition}

        {/* ─── ACT 3: THE FEELING ─── */}

        <TransitionSeries.Sequence durationInFrames={SCENES.brainPowerBelt}>
          <BrainPowerBelt />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.energyMeter}>
          <EnergyMeter />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.performanceStats}>
          <PerformanceStats />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.multiLanguageFlash}>
          <MultiLanguageFlash />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.theBreath}>
          <TheBreath />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.closingWords}>
          <ClosingWords />
        </TransitionSeries.Sequence>
        {standardTransition}

        <TransitionSeries.Sequence durationInFrames={SCENES.logo}>
          <Logo />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
