# Celebrations

What only a celebration does in motion: how loud it is, when it plays, and the order of its beats. How a celebration's screen is laid out, still, is in zoonk-design's [celebrations](../../zoonk-design/references/celebrations.md).

## How loud

A celebration is louder as it's rarer (the ladder on `/design/motion`): a task's end counts its Brain Power up; a level lands its badge; today's missions and a milestone may burst once. Every result draws what it did to the day with `DayMoment`, which keeps the beats in order (missions, then the level and Energy after them), so a new result gets the motion by using it.

## Once, right after the action

This keeps the old rule (nothing animates in; motion shows what an action did) and opens one door: a celebration is what the learner's action earned, so it plays once, right after that action. A reload, a revisit or the way back shows its end state, still. `useCelebration` (`@zoonk/ui/hooks/celebration`) says when: false on a page the server drew and on a page the router kept and shows again on Back once it was seen (hiding it restarts its CSS animations); `CountUp` and `Burst` follow it on their own, and moving parts take their `animate-*` classes only while it's true. Where only the screen knows a celebration was already seen (a step the learner goes back to in `Steps`, a result reopened from a link, the summary opened again from Today), wrap it in `CelebrationScope play={…}`.

## Beats

- **The spring lands objects; data never overshoots.** The spring (Apple's bouncy: bounce 0.3) is for something earned landing: a badge, a check, the art. A meter or a number stops at its value, and color and opacity never bounce.
- **One thing at a time, in reading order.** The number with its meter, then what it earned lands, then the buddy reacts; a burst goes with the last beat. Beats about 250 ms apart, things of one kind 100 ms apart (three at most), the last beat by 750 ms and everything still within 1.5 s.
