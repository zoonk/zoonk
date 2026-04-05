---
name: zoonk-video-design
description: "Video design principles and preferences for building Zoonk launch/product videos with Remotion. Use when creating, reviewing, or iterating on video scenes, animations, timing, text reveals, or overall video structure."
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Zoonk Video Design

Principles and patterns for building product videos. These are hard-won preferences from iterating on the Zoonk launch video — follow them exactly.

## When to use

Use this skill whenever working on Remotion video code — creating scenes, adjusting timing, designing text animations, structuring narrative flow, or reviewing video output.

## Core Philosophy

**Be a storyteller, not a feature demonstrator.** Every scene should feel like you're explaining Zoonk to a friend — conversational, warm, intentional. The viewer should never have to think about what they're seeing or why.

- **Guide the viewer.** Hold their hand through the story. Explain every feature on screen: what it is, why it exists, why it matters
- **Show, then tell.** Lead with explanatory text, then illustrate with UI elements
- **Be literal.** Don't show abstract UI and expect the viewer to understand. "Fill in the blank" + an "Activity" label tells nobody anything. Instead: "You learn by making decisions" + show the full interaction
- **Lead with WHY, then WHAT.** Don't say "Every lesson has visuals." Say "Complex things, made simple. Charts. Diagrams. Timelines." The viewer needs to know why they should care before they see what it is
- **Avoid negative framing.** Never show "bad" alternatives. Don't say other platforms are bad. Focus entirely on showing how Zoonk is great

## Visual Style

- **White background throughout.** Never alternate between black and white — it causes flickering and forces the viewer's eyes to re-adapt constantly
- **Apple keynote style.** Isolated elements, generous whitespace, clean typography, minimal decoration
- **Geist font family.** Regular (400), Medium (500), SemiBold (600), Bold (700)
- **No voiceover.** Music only. All storytelling happens through on-screen text and UI illustrations

## Transitions

- **Hard cuts only (Series, not TransitionSeries).** Crossfades cause ghosting when both scenes share the same white background — elements from both scenes become visible simultaneously during the blend
- **Each scene handles its own entry animation.** Content fades in from the white background using `entryScale`, so transitions feel natural without crossfades
- **No dead time.** Cut to the next scene as soon as the last element finishes appearing. Calculate when the last animation ends and trim the scene duration to match (plus a very short beat of ~10-15 frames max)

## Text Reveals

### First element: instant (hard cut)

The first text on each scene appears immediately — full opacity, no animation. Fading in the opening text hurts readability and wastes the viewer's reading time.

### Subsequent text: word-by-word reveal

Payoff lines reveal word by word with variable timing that mimics natural speech rhythm. This creates suspense and lets the story build.

**Pattern:**

```
"We explain hard things"          ← instant (hard cut, frame 0)
  ↓ 18-frame pause
"using"                           ← 3-frame fade
  ↓ 5 frames (short word follows)
"stuff"                           ← 3-frame fade
  ↓ 5 frames
"you"                             ← 3-frame fade
  ↓ 7 frames (content word follows)
"already"                         ← 3-frame fade
  ↓ 10 frames (final word follows)
"know."                           ← 3-frame fade
  ↓ 20-24 frame pause
[icons appear below]
```

**Timing rules:**

- Gap before word sequence starts: **18 frames** (~0.6s)
- Between small connective words (a, an, by, in, so, the, to, you, your): **5 frames**
- Between content/meaningful words: **7 frames**
- Before final/emphasized word of a sentence: **10 frames**
- Each word fades in over **3 frames** (opacity only, no scale or translate)
- Gap after full line completes, before next element: **20-24 frames**

### Weight and color contrast for emphasis

Use a **consistent pattern** for the setup/payoff pair across all scenes:

- **Setup line (instant):** Bold (700), dark color (`COLORS.text` / `#0f0f0f`)
- **Payoff line (word-by-word):** Regular (400), muted color (`COLORS.muted` / `#78716c`)

This creates clear visual hierarchy — the setup grabs attention, the payoff reads as a lighter continuation. Apply this consistently to every scene. Don't mix patterns (eg bold+dark payoff in one scene, light+muted in another).

### Three-layer pattern for emotional scenes

For important feature explanations (Brain Power, Energy Level):

1. **Bold claim** at top — instant, 44px, weight 700
2. **Quiet philosophical reasoning** in middle — fades in, 22-24px, weight 400, muted color
3. **UI proof** at bottom — fades in after the text has settled

## Scene Structure

### Text-first, illustration-second

Every feature scene follows the same layout: explanatory text in the upper portion, UI illustration in the lower portion. This creates a consistent reading flow the viewer learns immediately.

### Related features should be adjacent

Group features that are conceptually connected. Example: Brain Power → Belt System → Energy Level. Don't scatter related concepts across the video.

### Show the full interaction loop

When demonstrating interactive features, show the complete flow — not just the success state:

1. User attempts (selects an option)
2. Wrong answer → red border + subtle shake
3. Feedback message appears explaining WHY it's wrong
4. Correct answer → green border

This communicates "we give learners instant, meaningful feedback."

## Timing & Pacing

- **Scene duration is driven by content, not fixed values.** Calculate when the last element finishes animating and set the scene duration to match
- **Video duration is flexible.** Don't force it to be exactly 60s. Use whatever time the story needs
- **No artificial pauses between groups.** When showing a list of items (eg chapters), let them cascade naturally with consistent stagger gaps — don't pause after the first few then speed up
- **Fast elements get tight stagger.** Icons, list items, belt circles: 3-4 frame gaps
- **Text needs breathing room.** Word-by-word reveals need the variable timing described above

## Animation Patterns

### Entry animations (`entryScale`)

- Scale 95% → 100% + opacity 0 → 1
- Duration: 12 frames (400ms)
- Easing: `Easing.bezier(0.16, 1, 0.3, 1)` (strong ease-out)
- **Only for elements appearing AFTER the scene's first element**

### Staggered lists

- Consistent gap per list (3-4 frames for fast cascades, 4-6 for slower reveals)
- No two-speed tricks (don't show 3 slow then 12 fast)

### Positioned elements

- When an element (like a search input) needs to stay fixed while content appears below it, use **absolute positioning** — not centered flex columns that slide together
- `position: absolute` + `top` + `left: 50%` + `translateX(-50%)` for centered absolute elements

## Content Rules

- **Use actual product naming.** "Brain Power" not "knowledge score." Never abbreviate (no "BP")
- **Verify features against the codebase.** Check belt colors, level names, feature existence. Don't show features that don't exist (eg "streak" — Zoonk has Energy Level, not streaks)
- **Use icons for abstract concepts.** Tabler Icons (`@tabler/icons-react`) can communicate ideas without text cards. A grid of everyday icons (basketball, car, pizza) instantly communicates "stuff you already know"
- **Left-aligned numbered lists.** When showing course chapters: left-aligned with quiet ordinals (14px, muted, fixed-width 28px column for number alignment), titles at 22px weight 500

## What NOT to Do

- Don't show disconnected UI elements without explanation
- Don't use crossfade transitions (TransitionSeries) — use hard cuts (Series)
- Don't fade in the first text element on a scene
- Don't pad scenes with dead time after the last element appears
- Don't show "before/after" comparisons with negative framing
- Don't use abstract labels like "Activity" — be specific about what the viewer is seeing
- Don't show all text at once — build it word by word for payoff lines
- Don't alternate background colors between scenes
- Don't use CSS transitions or Tailwind animation classes (Remotion won't render them)
