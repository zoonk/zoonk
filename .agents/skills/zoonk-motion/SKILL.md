---
name: zoonk-motion
description: Use when adding, reviewing or removing an animation, a transition or a celebration in a Zoonk interface.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Zoonk motion

Motion is a budget. Zoonk stays calm and fast because almost nothing moves, and that is what lets the few earned moments feel special: motion on every interaction makes the app feel slower, while the right motion in the right spot makes it feel alive. The tokens, their meanings and every pattern moving live (with a reduced-motion switch) are at `/design/motion` in the playground (`apps/playground/src/design-system/motion.ts`); the values are in `packages/ui/src/styles/globals.css`.

## When

The more often the learner meets something, the less it moves.

- **Still: everyday screens.** Navigation, page loads, tabs, list rows, typing and everyday taps show their new state at once. Content never animates in on its own: an entrance makes the page feel slow and says nothing. No route transitions, no staggered lists, and nothing loops except a wait (a spinner, a skeleton, the saving shimmer) while it waits.
- **Feedback: the learner's own action, as it happens.** A press, a pick, a check turning blue, a disclosure or an overlay opening from its trigger, the lesson's screen turning. Quick (150 ms) or base (200 ms) on the ease-out, never a spring or an overshoot. Whatever the keyboard does, and focus, changes at once.
- **Celebration: rare, earned moments.** A task's end (a lesson, a block, a notebook practice, a drill, a round, a call, a test), a mission done, a level or a tenth of Energy reached, a challenge won, today's missions all done, a milestone's ceremony (a belt, the buddy's next stage, new glasses). Only these get the spring, a number counting up, a meter filling from where it was, a burst or a character's whole body acting. Building or changing one: read [celebrations](references/celebrations.md).

## How

- **Tokens, never literal times or curves.** `duration-quick`, `-base`, `-pop`, `-settle`, `-fill`, `-burst`; `ease-out`, `ease-spring`; `animate-settle`, `-pop`, `-fill`, `-spark`; `press`; `CountUp` and `Burst` from `@zoonk/ui`. A script reads them with `readDuration` and `readEasing`, and a moment's beats come from `BEAT_MS` and `STAGGER_MS` (`@zoonk/ui/lib/motion`). Tailwind's plain transitions already take the quick time and the ease-out.
- **Never in the way.** Continue works from the first frame, nothing waits for an animation before acting or navigating, and leaving mid-moment just leaves. Use transitions for what the learner can toggle (they turn around mid-way) and keyframes only for one-shot celebrations.
- **Reduced motion lives in the tokens.** Under `prefers-reduced-motion: reduce` a celebration's durations are 0 and its animations none, so it shows its end state from the first frame, and a press doesn't give way; fades and color changes keep their time. Build on the tokens and it's handled. Motion is never the only cue: the words say the same.
- **Every phone.** Animate `scale`, `translate` and opacity only, which the compositor runs off the main thread; no `transition-all`, layout properties, blur, shadows or filters in motion; a dozen moving things at most; scripts write outside React's render (`CountUp` changes one attribute a frame).
- **Characters react or hold still.** The buddy and the Trickster act with their parts where something happened, never as one block. When one moves, read [characters](references/characters.md): how each acts, how an act is timed, where it reacts and where it holds still.
- **Check it by eye.** Replay it at 10% speed in DevTools' Animations panel, with reduced motion on (the page's switch, or the browser's emulation) and on a throttled CPU, and ask whether it still feels good the hundredth time. Unit-test real logic only; motion gets no E2E or component test ([testing](../zoonk-testing/SKILL.md)); see it in the [persona walk](../zoonk-persona-walkthrough/SKILL.md).

## What kinds

| Pattern                | Says                         | How                                                                                              | Where                                                                                                             |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Press                  | "My press landed."           | `press` gives way to `--press-scale` (0.97; a wide option 0.99)                                  | Buttons, answer options, choice rows                                                                              |
| State change           | "This is what changed."      | `transition-colors` in the quick time                                                            | A pick, a check turning blue, a task's segment                                                                    |
| Count-up               | "This much, adding up."      | `CountUp` in the fill's time, beside its meter                                                   | Brain Power at a task's end, the bonus, the summary                                                               |
| Something earned lands | "Something new is mine."     | `animate-settle` from `--settle-from` (0.5)                                                      | A new level's badge, a mission's check, a call's star                                                             |
| Meter filling          | "From where it was to here." | `animate-fill`, `origin-left`, `--fill-from`, only from a start the moment knows                 | A belt's new tick, the missions' track                                                                            |
| A character's reaction | "Someone is glad with me."   | An act with its parts, once, on the moment's beat (`reaction`); its landing, still, on a revisit | A mission done, today's missions, the summary, a ceremony; a challenge's intro, duel and result; the buddy's chat |
| Burst                  | "This one is rare."          | `Burst` in the moment's color, on its last beat                                                  | Today's missions all done, a new belt, the buddy's next stage                                                     |

## Why

The guidelines, research and product decisions behind these rules are in [why Zoonk moves this way](references/why.md), for when one is questioned.
