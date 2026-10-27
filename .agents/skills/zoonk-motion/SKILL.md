---
name: zoonk-motion
description: Decide whether and how a Zoonk interface moves. Everyday screens stay still, feedback is quick, and only rare earned moments (a level, a belt, missions, a challenge won, a lesson's end) celebrate with subtle, Apple-like motion. Use when adding, reviewing or removing an animation or transition.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Zoonk motion

Motion is a budget. Zoonk stays calm and fast because almost nothing moves, and that is what lets the few earned moments feel special: motion on every interaction makes the app feel slower, while the right motion in the right spot makes it feel alive. The tokens, their meanings and every pattern moving live (with a reduced-motion switch) are at `/design/motion` in the playground (`apps/playground/src/design-system/motion.ts`); the values are in `packages/ui/src/styles/globals.css`.

## When

The more often the learner meets something, the less it moves.

- **Still: everyday screens.** Navigation, page loads, tabs, list rows, typing and everyday taps show their new state at once. Content never animates in on its own: an entrance makes the page feel slow and says nothing. No route transitions, no staggered lists, and nothing loops except a wait (a spinner, a skeleton, the saving shimmer) while it waits.
- **Feedback: the learner's own action, as it happens.** A press, a pick, a check turning blue, a disclosure or an overlay opening from its trigger, the lesson's screen turning. Quick (150 ms) or base (200 ms) on the ease-out, never a spring or an overshoot. Whatever the keyboard does, and focus, changes at once.
- **Celebration: rare, earned moments.** A lesson's or a block's end, a mission done, a level or a tenth of Energy reached, a challenge won, today's missions all done, a milestone's ceremony (a belt, the buddy's next stage, new glasses). Only these get the spring, a number counting up, a reward lighting up, the buddy's hop or a burst, and louder as they're rarer (the ladder on `/design/motion`): a lesson's end counts its Brain Power up; a level lands its badge; today's missions and a milestone may burst once.

This keeps the old rule (nothing animates in; motion shows what an action did) and opens one door: a celebration is what the learner's action earned, so it plays once, right after that action. A reload, a revisit or the way back shows its end state, still.

## How

- **Tokens, never literal times or curves.** `duration-quick`, `-base`, `-pop`, `-settle`, `-fill`, `-burst`; `ease-out`, `ease-spring`; `animate-settle`, `-pop`, `-hop`, `-fill`, `-spark`; `press`; `CountUp` and `Burst` from `@zoonk/ui`. A script reads them with `readDuration` and `readEasing` (`@zoonk/ui/lib/motion`). Tailwind's plain transitions already take the quick time and the ease-out.
- **The spring lands objects; data never overshoots.** The spring (Apple's bouncy: bounce 0.3) is for something earned landing: a badge, a check, the art. A meter or a number stops at its value, and color and opacity never bounce.
- **One thing at a time, in reading order.** The number with its meter, then what it earned lands, then the buddy reacts; a burst goes with the last beat. Beats about 250 ms apart, things of one kind 100 ms apart (three at most), the last beat by 750 ms and everything still within 1.5 s.
- **Never in the way.** Continue works from the first frame, nothing waits for an animation before acting or navigating, and leaving mid-moment just leaves. Use transitions for what the learner can toggle (they turn around mid-way) and keyframes only for one-shot celebrations.
- **Reduced motion lives in the tokens.** Under `prefers-reduced-motion: reduce` a celebration's durations are 0 and its animations none, so it shows its end state from the first frame, and a press doesn't give way; fades and color changes keep their time. Build on the tokens and it's handled. Motion is never the only cue: the words say the same.
- **Every phone.** Animate `scale`, `translate` and opacity only, which the compositor runs off the main thread; no `transition-all`, layout properties, blur, shadows or filters in motion; a dozen moving things at most; scripts write outside React's render (`CountUp` changes one attribute a frame).
- **Check it by eye.** Replay it at 10% speed in DevTools' Animations panel, with reduced motion on (the page's switch, or the browser's emulation) and on a throttled CPU, and ask whether it still feels good the hundredth time. Unit-test real logic only; motion gets no E2E or component test ([testing](../zoonk-testing/SKILL.md)); see it in the [persona walk](../zoonk-persona-walkthrough/SKILL.md).

## What kinds

| Pattern                | Says                         | How                                                                              | Where                                                         |
| ---------------------- | ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Press                  | "My press landed."           | `press` gives way to `--press-scale` (0.97; a wide option 0.99)                  | Buttons, answer options, choice rows                          |
| State change           | "This is what changed."      | `transition-colors` in the quick time                                            | A pick, a check turning blue, a task's segment                |
| Count-up               | "This much, adding up."      | `CountUp` in the fill's time, beside its meter                                   | Brain Power at a task's end, the bonus, the summary           |
| Reward lighting up     | "Earned, and it's this one." | Fill and check change in the quick time, then `animate-pop`                      | Today's reward when the missions complete                     |
| Something earned lands | "Something new is mine."     | `animate-settle` from `--settle-from` (0.5; large art 0.85)                      | A new level's badge, a mission's check, a ceremony's art      |
| Meter filling          | "From where it was to here." | `animate-fill`, `origin-left`, `--fill-from`, only from a start the moment knows | A belt's new tick, the missions' track                        |
| The buddy's reaction   | "Someone is glad with me."   | `expression="cheer"`, one `animate-hop` after the numbers                        | The missions' moment, the summary, a ceremony                 |
| Burst                  | "This one is rare."          | `Burst` in the moment's color, on its last beat                                  | Today's missions all done, a new belt, the buddy's next stage |

## Why

- Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/motion): "In apps, generally avoid adding motion to UI interactions that occur frequently"; "don't make people wait for an animation to complete". [WWDC23](https://developer.apple.com/videos/play/wwdc2023/10158/): springs keep their velocity when interrupted; bounce 0.3 is "noticeable", above 0.4 calls for caution. [WWDC26](https://developer.apple.com/videos/play/wwdc2026/250/): "Delight isn't confetti". With Reduce Motion, Apple replaces movement with fades ([Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)).
- [Material 3](https://m3.material.io/styles/motion/overview/how-it-works) splits springs into spatial (they may overshoot) and effects (color and opacity, never).
- Vercel's [Web Interface Guidelines](https://vercel.com/design/guidelines): honor reduced motion, CSS before scripts, transform and opacity, cancelable by input, never `transition: all`, only for cause and effect or deliberate delight.
- WCAG 2.2: [2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) (movement over 5 s needs a way to stop it) and [2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
