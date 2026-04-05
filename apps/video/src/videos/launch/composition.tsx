import { AbsoluteFill, Audio, Series, interpolate, staticFile, useVideoConfig } from "remotion";
import { SCENES } from "./constants";
import { EverydayLanguage } from "./scenes/act1/everyday-language";
import { SearchPrompt } from "./scenes/act1/search-prompt";
import { LanguageTransform } from "./scenes/act2/language-transform";
import { StoryClaim, StoryCorrect, StoryFeedback } from "./scenes/act2/story-branch";
import { VisualsGrid } from "./scenes/act2/visuals-grid";
import { VisualsHeadline } from "./scenes/act2/visuals-headline";
import { BeltSystem } from "./scenes/act3/belt-system";
import {
  BrainPowerIntro,
  BrainPowerNeverDown,
  BrainPowerPhilosophy,
} from "./scenes/act3/brain-power";
import { ClosingWords } from "./scenes/act3/closing-words";
import { EnergyDip, EnergyIntro, EnergyRecovers } from "./scenes/act3/energy-meter";
import { Logo } from "./scenes/act3/logo";
import { PatternsData, PatternsIntro, PatternsPayoff } from "./scenes/act3/performance-stats";
import { Website } from "./scenes/act3/website";
import { type LaunchVideoProps } from "./schema";
import { TranslationProvider } from "./use-translations";

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
export function LaunchVideo({ locale }: LaunchVideoProps) {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <TranslationProvider locale={locale}>
      <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
        {/* Background music — fades in over 2s, out over 3s */}
        <Audio
          src={staticFile("audio/background.mp3")}
          volume={(f) => {
            const fadeIn = interpolate(f, [0, 2 * fps], [0, 0.2], {
              extrapolateRight: "clamp",
            });
            const fadeOut = interpolate(
              f,
              [durationInFrames - 3 * fps, durationInFrames],
              [0.2, 0],
              {
                extrapolateLeft: "clamp",
              },
            );
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

          <Series.Sequence durationInFrames={SCENES.storyClaim}>
            <StoryClaim />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.storyCorrect}>
            <StoryCorrect />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.storyFeedback}>
            <StoryFeedback />
          </Series.Sequence>

          {/* ─── ACT 2: THE PROOF ─── */}

          <Series.Sequence durationInFrames={SCENES.visualsHeadline}>
            <VisualsHeadline />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.languageTransform}>
            <LanguageTransform />
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

          <Series.Sequence durationInFrames={SCENES.energyIntro}>
            <EnergyIntro />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.energyDip}>
            <EnergyDip />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.energyRecovers}>
            <EnergyRecovers />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.patternsIntro}>
            <PatternsIntro />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.patternsData}>
            <PatternsData />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.patternsPayoff}>
            <PatternsPayoff />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.website}>
            <Website />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.closingWords}>
            <ClosingWords />
          </Series.Sequence>

          <Series.Sequence durationInFrames={SCENES.logo}>
            <Logo />
          </Series.Sequence>
        </Series>
      </AbsoluteFill>
    </TranslationProvider>
  );
}
