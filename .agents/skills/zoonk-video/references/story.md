# Story

## Structure

The 2.0 launch film (`example/zoonk-2/long.js`) follows a proven shape:

1. **Cold open.** Real goals typed into the goal box, then the questions every learner has. The brand comes in about 10 s.
2. **Reveal.** A dark frame, the logo, the version and the tagline.
3. **How it works.** One phone stays in the scene while its screens change and the camera follows the voice: goal, what you know, honest time, Today, missed day.
4. **Every goal.** The four goal cards, then exams, languages, career and learn anything, each with its best real screens.
5. **Lessons.** Real activities in one phone, a wrong answer explained, Zu, help inside a lesson.
6. **Progress.** Energy instead of streaks, Brain Power and belts, the Trickster.
7. **Payoff.** The cold-open goals checked off, "one day at a time", the ten languages.
8. **CTA.** Held long enough for the end screen.

The vertical cut keeps the hook, the plan, learning by doing, a wrong answer, Zu, progress, any goal and the CTA, ending on the first frame.

## Facts come from the code

The blog and old copy go stale. For every claim, open the code that decides it:

- **Copy and labels:** the gettext catalogs in `packages/{learn,player}/messages/{en,pt}.po` and `apps/main/messages/{en,pt}.po`. The harness loads them the way Main does, so screens show the app's exact wording in each language.
- **Rules:** `packages/core`. Read the actual constants before stating numbers, for example:
  - `checkpoints/checkpoint-rules.ts` (10 questions, 70% to pass)
  - `sessions/brain-power.ts` (`phaseBoss: 200`)
  - `progress/energy.ts`
  - `learner/test-out/test-out-rules.ts` (80%)
  - `plans/planner/plan-change-thresholds.ts` (what changes without asking)
- **Behavior:** the components and view models. Some features differ from how they're described elsewhere:
  - The automatic missed-day change has no Undo; only the learner's own edits do.
  - A career is a `learn` goal; there's no tool picker beyond "I have it / I'll set it up / No install".
  - The "What changed" card is for source updates, not missed days.
  - Mock exams are Plus.
- **Goals per locale:** take them from the landing page's example sets (`apps/main/src/app/[lang]/(home)/_components/example-sets/{en,pt}.ts`).
  - en: SAT, Spanish to live in Mexico City, data analyst with Tableau.
  - pt: Enem, inglês para morar em Londres, analista de dados com Power BI.
  - Brazil-specific goals, Portuguese explanations and Brazilian history belong only in the pt cut.

## Copy

- **Supers:** a headline of at most about 20 characters per line, broken with `<br>`, used only where [composition](#composition) allows. Write the pt line yourself in natural Brazilian Portuguese; don't translate word by word.
  - Vertical: a short subline under the headline, since many watch with the sound off.
- **Brand terms in pt:** Energia, Poder Mental, faixas, Pegadinha, parceiro (not "buddy"), ofensiva (for streak), edital, simulado.
- **CTA:**
  - "What's your goal? · zoonk.com · Start free, no account needed."
  - pt: "Qual é o seu objetivo? · zoonk.com · Comece grátis, sem precisar de uma conta."
  - The site sends Portuguese browsers to `/pt` by itself.
- **No prices** in videos.

## Composition

One focal point at a time. When a launch film put the headline on the left and the phone on the right in every scene, viewers didn't know where to look and lost the thread. In 16:9:

- **Never put text beside the phone.**
- **Narrated: no headlines on product scenes.** The voice says it, and the uploaded `.srt` captions carry it with the sound off.
  - A headline before each screen took about 2 s from the screen and cut away before anyone finished reading it.
  - Text stays only where the words are the picture: the typed goals and questions of the cold open, the brand reveal, the checked-off goals, the ten languages and the CTA.
  - A chapter visual keeps its picture and drops the headline the voice says: the four goal cards, Zu cheering.
- **Unnarrated:** each beat shows its headline alone in the middle, then the phone alone. The phone blurs out under the headline, and the headline clears before the phone comes back.
- **Frame what the voice describes.** A scene's phone comes into focus already framed on that part of the screen, at 1.6–2.4× (`focusIn()` and `cam()` in `example/zoonk-2/long.js`), so the UI reads even on a phone. Pan to the next part as the voice moves on instead of pulling back to the whole screen.
- **One phone per scene.** Screens push in on the beat while the camera reframes.
- **A run of screens** (activities, steps) plays inside one phone, each pushed in as the voice names it. Two phones side by side compete, even faded and mid-swipe.
- **Transitions:** a phone blurs out on the cut and the next one blurs in from it, never overlapping: two phones framed differently read as two things. After a scene without a phone, the phone waits until that scene has faded out. Text dissolving over a phone reads as two things at once too.
- **Markers** (rings, taps) end with their beat, and land inside the frame. A ring left on would circle an unrelated row on the next screen.
  - Measure tap targets on the current captures: screens move when the app changes.
  - Time a tap just before the frame it causes. `K.seq` spreads frames by their `hold` weights in `manifest.json`, so compute when that frame starts instead of guessing.
- **Vertical:** the super sits above the phone in one column, which reads top to bottom. Keep anything else off the frame.

## Pace

- Hold each super for about 0.28 s per word plus 0.6 s, at least about 1.8 s.
- Words reveal 0.045 s apart, each over 0.6 s.
- The next scene is already moving when a cut lands. Avoid a blank frame between scenes; dissolves between two light scenes run about 0.3–0.5 s. The one exception is phone to phone: the quick blur dip through the cut (about 0.1 s nearly empty) reads as one transition, where a dissolve would show two phones.
- Cuts land on half bars of the soundtrack's grid: `Z.BAR` is 2.4 s at 100 BPM. Change it if the bed has another tempo.
- About 2:30 of story and about 40 s vertical felt right to the owner. 3:36 felt sluggish.

## Plan before building

- Write a scene table (time, visual, en and pt narration or supers) plus the goals per locale.
- Get it approved before rendering anything.
- List the corrections the code made to earlier assumptions, so the user sees why the story changed.
