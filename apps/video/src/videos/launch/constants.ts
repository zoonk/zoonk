import { FPS } from "@/lib/constants";

/**
 * Scene durations in frames for the launch video.
 * No crossfades — each scene handles its own entry/exit animations
 * against the shared white background. Hard cuts between scenes.
 *
 * NARRATIVE ARC:
 * ACT 1: THE SPARK — curiosity, understanding
 * ACT 2: THE PROOF — how it works, see for yourself
 * ACT 3: THE FEELING — this respects you, you can do this
 */
export const SCENES = {
  // ACT 1: THE SPARK
  searchPrompt: 4 * FPS,
  everydayLanguage: 3.5 * FPS,
  storyClaim: 3 * FPS,
  storyCorrect: 4 * FPS,
  storyFeedback: 4.5 * FPS,

  // ACT 2: THE PROOF
  visualsHeadline: 3.5 * FPS,
  languageTransform: 5 * FPS,
  visualsMontage: 6 * FPS,
  visualsGrid: 2.5 * FPS,

  // ACT 3: THE FEELING
  brainPowerIntro: 3.5 * FPS,
  brainPowerNeverDown: 2 * FPS,
  brainPowerPhilosophy: 3 * FPS,
  beltSystem: 5 * FPS,
  energyIntro: 3.5 * FPS,
  energyDip: 3 * FPS,
  energyRecovers: 3.5 * FPS,
  patternsIntro: 3 * FPS,
  patternsData: 3.5 * FPS,
  patternsPayoff: 2.5 * FPS,
  logo: 1.5 * FPS,
  closingWords: 2 * FPS,
  website: 1.5 * FPS,
} as const;
