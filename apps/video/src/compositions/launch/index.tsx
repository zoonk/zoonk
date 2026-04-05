import { EverydayLanguage } from "@/components/scenes/act1/everyday-language";
import { SearchPrompt } from "@/components/scenes/act1/search-prompt";
import { LanguageTransform } from "@/components/scenes/act2/language-transform";
import { StoryBranch } from "@/components/scenes/act2/story-branch";
import { VisualsHeadline } from "@/components/scenes/act2/visuals-headline";
import { VisualsGrid } from "@/components/scenes/act2/visuals-grid";
import { VisualsMontage } from "@/components/scenes/act2/visuals-montage";
import { BeltSystem } from "@/components/scenes/act3/belt-system";
import {
  BrainPowerIntro,
  BrainPowerNeverDown,
  BrainPowerPhilosophy,
} from "@/components/scenes/act3/brain-power";
import { ClosingWords } from "@/components/scenes/act3/closing-words";
import { EnergyMeter } from "@/components/scenes/act3/energy-meter";
import { Logo } from "@/components/scenes/act3/logo";
import { PerformanceStats } from "@/components/scenes/act3/performance-stats";
import { SCENES } from "@/lib/constants";
import { AbsoluteFill, Audio, Series, interpolate, staticFile, useVideoConfig } from "remotion";
import { type LaunchVideoProps } from "./schema";

/**
 * Zoonk launch video — storytelling version.
 *
 * Uses hard cuts (Series) instead of crossfades. Each scene handles
 * its own entry animation (entryScale) against the white background,
 * so transitions feel clean — content fades in from white, then cuts
 * to the next scene which also fades in from white. No ghosting.
 *
 * NARRATIVE ARC:
 * ACT 1: THE SPARK — curiosity, understanding
 * ACT 2: THE PROOF — how it works
 * ACT 3: THE FEELING — this respects you, you can do this
 */
export function LaunchVideo(_props: LaunchVideoProps) {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
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

      <Series>
        {/* ─── ACT 1: THE SPARK ─── */}

        <Series.Sequence durationInFrames={SCENES.searchPrompt}>
          <SearchPrompt />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.everydayLanguage}>
          <EverydayLanguage />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.storyBranch}>
          <StoryBranch />
        </Series.Sequence>

        {/* ─── ACT 2: THE PROOF ─── */}

        <Series.Sequence durationInFrames={SCENES.visualsHeadline}>
          <VisualsHeadline />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.languageTransform}>
          <LanguageTransform />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.visualsMontage}>
          <VisualsMontage />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.visualsGrid}>
          <VisualsGrid />
        </Series.Sequence>

        {/* ─── ACT 3: THE FEELING ─── */}

        <Series.Sequence durationInFrames={SCENES.brainPowerIntro}>
          <BrainPowerIntro />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.brainPowerNeverDown}>
          <BrainPowerNeverDown />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.brainPowerPhilosophy}>
          <BrainPowerPhilosophy />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.beltSystem}>
          <BeltSystem />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.energyMeter}>
          <EnergyMeter />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.performanceStats}>
          <PerformanceStats />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.closingWords}>
          <ClosingWords />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENES.logo}>
          <Logo />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}
