# Course experience: independent discovery and design review

Final verification, 13:48 local: Main production build 7 passed all 444 browser tests after two complete lesson-generation repetitions passed 32/32. Main 36 files / 276 tests, backend/HTTP/Player/AI/native suites and final static checks are recorded in `COURSE-REDESIGN-PLAN.md`. The prior dated checkpoints below retain their historical limits; their pending Main browser gate is now closed. No production code changed after the independently reviewed build 7. The final requirements ledger is the current completion record.

Status: independent discovery, iterative implementation review, and final source reconciliation are complete. This uncommitted document preserves the proposal and review history; the final verification note above supersedes historical pending-check statements. `PROBLEMS.md` remains the source of truth. Read the whole brief, including its final Notes, before each significant implementation slice and at final reconciliation.

## Product conclusion

Make the product feel like a helpful next lesson, with a course behind it. A learner chooses what they want to achieve and starts somewhere suitable; Zoonk chooses the content and sequence. The course stays comprehensive where appropriate, while a learner's current plan has a comprehensible scope. Configuration belongs in a short guided flow and a course-specific editor. It does not belong beside the main learning action.

The most important change is removing work the learner currently has to do: understand a huge flat curriculum, infer difficulty from position, choose between unexplained activity types, and repeatedly locate their next lesson. A clean coat of styling over those decisions would not solve the brief.

## What was inspected

- Entire `PROBLEMS.md`, including the final Notes and definition of done.
- Zoonk design, Apple HIG, copywriting, and copy-editing skills; Main/Apple and web localization guidance.
- Existing Main prompt result, course detail/sidebar/chapter grid, chapter lesson list, My courses, lesson unavailable/summary and completion surfaces.
- Existing Apple CourseView, ChapterView, AccountSheet, MyCoursesView and creation placeholder, with surrounding file inventory.
- Blog posts `future-of-education`, `education-is-broken`, `learning-anything`, and `how-zoonk-lessons-work`.
- Course personalization eval inputs, including multi-subject and highly specific real requests.
- Official shadcn Questionnaire documentation and current registry inventory; official Apple HIG onboarding/settings/pickers/lists documentation; official Duolingo product/research posts.

Runtime status: source inspection only in this discovery review. Root is inspecting the running isolated Main app at `http://main.zoonk-6f86.localhost:1355`. No browser or simulator observations are claimed here. Each implemented slice still needs independent rendered review.

## Problems confirmed in the current implementation

1. Course sidebar resolves the initial fallback to `chapters[0]`; the full flat chapter grid uses chapter position as a proxy for difficulty. Neither expresses a learner's starting point.
2. Chapter pages intermingle explanation, practice, quiz, and review as numbered primary lessons. The current filter controls make learners understand content taxonomy and can make course completion depend on a display preference.
3. Prompt handling sends ordinary requests directly to course resolution/generation, while question and personalized requests remain a waitlist state. It has no coherent discovery-to-first-lesson handoff for those intents.
4. My courses presents course identity and description, without the contextual next lesson or useful plan scope that would help someone return.
5. Apple already owns course/chapter browsing, continuation and account settings. Native creation is a blank placeholder, and a complete native player is not implemented. Shared data changes must update existing surfaces without expanding into those unported features.
6. The existing lesson blog explains compulsory sequencing. That statement will become factually wrong if optional activities are introduced. Update the affected passage as part of the product change, preserving the philosophy of learning through understanding and use.

## Architecture decisions required by the experience

- A course has one identity and catalog entry. Level and learner plan do not create another course card.
- A reusable course can have levels and many chapters. A learner-owned ordered chapter selection determines their next lesson and scoped progress. The underlying catalog remains browseable.
- A plan is a recommendation, not an access boundary. Learners can enter another chapter without silently rewriting their saved plan; changing the plan is an explicit, reversible action.
- Public reusable course content must never contain a learner's personal goal, interests, workplace, health context, or private clarification answers. Private content and private discovery stay owner-scoped across lists, direct links, API, metadata, cache and generation status.
- A chapter can contain primary learning and optional activities without representing optional activities as obstacles to completing its learning sequence. The data must preserve that distinction independently from UI visibility.
- Core path completion, language study completion, and demonstrated competence are different concepts. Do not call finishing optional selected exercises language mastery or certified CEFR achievement.
- Course-specific goal, scope, starting point, pace and activity preferences stay on the course. Global interests belong in account/profile settings and apply only where examples can actually use them. A preference with no implemented effect should not appear as a control.
- Historical account achievements remain durable even when course content changes. Revised curriculum can have new learning ahead without erasing the learner's prior work or incorrectly showing all replacement material as completed.

## Recommended interaction model

### Shared visual grammar

Use a readable, narrow primary column for decisions, normally about 32–36rem wide. Left-align headings and descriptions. Keep the current semantic palette, type scale and spacing. Use the course/chapter imagery to make subject matter attractive; avoid surrounding every piece of metadata in another outlined card. One primary button per state. Secondary navigation remains visibly secondary.

Question choices are full-width rows with a title and one concrete explanation. A selected row has a clear indicator and semantic checked state. Never auto-advance on choice selection: retain a stable Continue button, especially for keyboard and screen-reader users. Long translated text may wrap; rows grow rather than clip.

Use the official shadcn Questionnaire primitive for question/answer semantics, navigation and focus. Zoonk's page composition owns persistence, branching and submission. Do not use a chat transcript as the primary discovery UI: it consumes vertical space and makes it difficult to identify the active question or change a prior answer.

### Learning request entry

Keep a single input whose job is to express an outcome or subject. Heading: **What would you like to learn?** Supporting examples can rotate or remain few: **A subject, a question, or something you want to do.** Example input: **Understand quantum physics**. Another: **Use Python to automate reports at work**.

Avoid presenting Core / Language / Personalized / Question as initial options. Classification is the product's responsibility. Preserve the original request through sign-in and follow-up questions. A resolved subject should not silently replace the user's intended outcome.

An explicit, narrow question can proceed to its concise course preview without a generic goal, pace and level questionnaire. A broad subject needs scope and usually a starting point. A very specific request needs only the unresolved questions that change what the curriculum teaches.

### Direct existing course visit: new learner

The initial course view has identity, a plain outcome description, **Start**, and a quiet **Browse curriculum** action. It does not have a panel of personalization selectors. The learner can inspect chapter imagery below a concise overview or open the full curriculum; it must not render 150–200 chapters as the default unbounded first impression.

Start enters the same guided setup as a prompt that resolves to this course. A direct visit must not bypass personalization, while chapter/lesson deep links that express an exact learning choice should remain usable without an unrelated setup wall.

### Core setup: first choose scope

Question: **How would you like to learn {subject}?**

| Choice                   | Description                                            | Behavior                                                                                                                       |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Get an overview          | Understand the main ideas through everyday examples.   | Select the deliberate 3–6 chapter overview.                                                                                    |
| Explore the full subject | Learn step by step, from the basics to advanced ideas. | Select the comprehensive progression from a suitable starting point.                                                           |
| Work toward a goal       | Focus on what you want to be able to do.               | Ask for the outcome and select relevant reusable content, or route to private discovery if reusable content cannot satisfy it. |

Do not preselect Overview simply because short learning is useful. Inferred scope from an explicit prompt can be shown as the proposed choice and changed without another question. Example: a prompt saying “from basics to mastery” should not be asked whether they wanted only an overview.

For the overview, start with the intuitive overview sequence. Do not demand a proficiency self-assessment before this deliberately approachable introduction. For full-subject learning, ask the starting-point question unless it is already clear. For a goal, ask the missing outcome before level.

### Core starting point

Question: **How familiar are you with {subject}?**

| Choice               | Description                                    |
| -------------------- | ---------------------------------------------- |
| I'm new to this      | Start with clear, everyday explanations.       |
| I know the basics    | Build on the ideas I already know.             |
| I use it confidently | Focus on more advanced ideas and applications. |
| I'm not sure         | Help me find a comfortable place to start.     |

Internally map these to real chapter difficulty and prerequisites. Do not infer difficulty from each ten chapter positions or share belt ranks with course levels. The uncertain path should offer a sensible starting chapter with a quiet **Choose a different chapter** route; it must not imply a diagnostic test exists when one does not.

### Goal-focused reusable path

Question: **What would you like to be able to do?** Prefer relevant options inferred from the subject, with **Something else** and a labeled freeform answer. Python example: **Automate work**, **Build an app**, **Understand programming**, **Something else**. Do not ask this again if the original request already answers it.

A goal answer must change chapter selection or emphasis meaningfully. “Build an app with AI” should include problem decomposition, reading/editing code, agent use, debugging, testing and validation; “understand computer science” should retain fundamentals. Both can draw from a comprehensive reusable course, but should not pretend to be personalized if both get an identical linear sequence.

Show a compact start preview only when it helps clarify a non-obvious tailored selection: **Your first chapter: Turning a task into clear steps** followed by **We'll focus on planning, reading code, and checking results.** Primary **Start learning**. Secondary **Change choices**. Avoid a large all-preferences recap that becomes another form.

### Language starting point

Language uses CEFR, never Overview/Basic/Intermediate/Advanced as replacement labels. Start with **Where would you like to begin?** and six selectable rows with short ability descriptions:

| Level                          | Human explanation                                     |
| ------------------------------ | ----------------------------------------------------- |
| A1 · Getting started           | Everyday words and simple introductions.              |
| A2 · Everyday basics           | Simple conversations about familiar things.           |
| B1 · Independent conversations | Handle common situations and share experiences.       |
| B2 · Confident conversations   | Discuss ideas and follow more detailed conversations. |
| C1 · Advanced language         | Express complex ideas clearly and flexibly.           |
| C2 · Precise expression        | Understand nuance and communicate with precision.     |

Use the codes prominently enough that learners who know their level can choose instantly. Keep **I'm not sure** as a separate modest choice. Self-selection is a valid first implementation; do not create a mandatory test. If an optional placement estimate is implemented, explain that it suggests a starting point, retain **I don't know** answers and a manual override, and avoid certification claims. A short quiz cannot establish complete CEFR proficiency across untested skills.

For a known learner, continue at their saved chapter; do not ask the level again on every course visit. A course language/edition change preserves the intended level and does not restart at A1.

### Formats: explain before asking

Do not insert an obligatory checklist of `explanation`, `quiz`, `practice`, `reading`, `translation`, etc. into first-course setup. Most people have not experienced the formats and cannot make an informed preference yet.

Default core learning uses short explanations as the primary path. Optional practice and quizzes remain available without becoming completion requirements. A learner can use **Choose activities** from course preferences or a quiet optional route before starting; skipping uses the default and still starts learning.

The optional chooser begins: **Choose how you'd like to learn**. Supporting copy: **Start with our suggestions, or choose the activities you enjoy. You can change this for this course anytime.** Primary **Use suggested activities**. Secondary **Choose activities** enters the explained sequence.

Present one unfamiliar activity at a time, with an actual representative miniature example and a short description:

- **Try it in a situation** — **Use what you learn to make a decision in a real-life example.** A small scenario preview, not a generic icon alone. Choices **Include practice** / **Skip practice**.
- **Check your understanding** — **Answer a few short questions and see why each answer works.** Show a small ordinary question with answer choices and feedback example. Choices **Include quizzes** / **Skip quizzes**.

This chooser controls optional recommendations, never the integrity of primary completion. Keep plain labels such as Practice and Quizzes in the editor once they have been explained. Do not repeatedly interrupt every lesson with the chooser.

Language skills need distinct treatment: reading, listening, writing-system learning and active language exercises are not all equivalent to optional core companion quizzes. If a learner excludes a skill, make the selected study scope clear and never equate completion with full language proficiency. Do not allow all available teaching modes to be silently filtered into an empty path.

### Time and interests: defer where appropriate

Time is not a reason to shorten a comprehensive curriculum or make lessons longer for intensive learners. A pace preference should change the recommended session size, e.g. one or three short lessons. Ask **How much time would you like to spend when you learn?** only when the implementation uses it; choices **A few minutes**, **About 10 minutes**, **A longer session**, and **No preference**. It is optional and course-specific. A selected session ending is a natural **Done for now** opportunity, never a forced stop or a guilt prompt.

Global **Interests** belongs under Profile/Account on web and Apple. Heading **What interests you?** Description **Choose topics you enjoy. We can use them in examples when they fit what you're learning.** Use a modest selectable list with familiar labels and **Add an interest**. No forced selection or maximum presented as a product requirement. Save and clear are meaningful; interests should not leak into reusable course content or automatically change unrelated learning goals.

### Personalized discovery

Private generation requires sign-in before saving personal answers or generating a private curriculum. Explain why at the boundary: **Sign in to create your course** / **Your goals and course will stay in your account.** Preserve the original prompt and return to the same discovery step after authentication.

Display one relevant question at a time. Example original prompt: “I want to apply neo-Riemannian theory on guitar through exercises.” Useful questions concern knowledge of basic chords, guitar experience, desired musical context, and whether notation or fretboard examples are comfortable. Asking “What subject do you want to learn?” again is wasteful.

Follow-ups are dynamic and may continue as long as unresolved answers materially change the learning content. Do not impose an arbitrary question cap. Equally, do not add arbitrary questions to fill a template. Show **A little more about your goal** or a known phase, not “Question 2 of 3” when the number is unknown. Preserve answers across Back, refresh, sign-in, generation failure and retries. A user can leave the flow and resume; leaving is not silently interpreted as consent to generate.

Before private generation, show a concise confirmed outcome and first-chapter direction with **Create my course**. If the request is sufficiently specified already, skip redundant clarification and show that preview. Keep raw AI reasoning, cost tiers, internal course type, JSON and orchestration status out of product copy.

### Combined subjects and tracks

When a prompt genuinely asks for separate subjects, present the suggested courses together: **Learn physics and chemistry** / **Follow these courses together in a track.** Show two course rows with title and one-line purpose. Primary **Start track**. Each row can still be opened to study the course alone. Do not require the learner to first understand a new organizational model or manually recreate the set.

A track is a learner-owned grouping of existing course identities, not another generated mixed curriculum and not a separate copy of each course. Closely integrated interdisciplinary requests may still warrant a private curriculum; classification must follow the outcome rather than splitting every “and” in a prompt.

Track detail has a title, one **Continue** action, a small progress label and the ordered course rows. Initial ordering can be the suggested order; keep reordering and removal in Edit. Do not add a course/project/track dashboard, badges for every metadata field, or a graph of dependencies.

In My courses, tracks and independent courses use the same quiet row rhythm. The track row has a small grouped-course image treatment or familiar stack icon, **2 courses**, and progress. Its children appear when it is opened. Do not repeat tracked courses as extra top-level course entries merely because each also has enrollment. A course used in more than one track remains the same course and shares real completion; a link from one track never duplicates its learning record.

### Returning course and chapter experience

Course header: title, compact current path summary (**Overview** or **Starting at B1**), useful scoped progress, and **Continue**. The next lesson's title can appear immediately below the button or within the current chapter treatment so the action has meaning. Secondary actions are **Browse curriculum** and **Course preferences** in a quiet menu or row.

Display the current chapter and upcoming plan chapters in an image-led, restrained sequence. Preserve chapter thumbnails for every generated chapter. The whole comprehensive curriculum lives in the browse view, grouped by real level; a native select or compact level navigation can narrow it. Avoid a row of six large CEFR tiles plus badges plus tabs plus filter chips all competing with Continue.

For a large full path, show a manageable initial set with **Show more chapters**, while making all content accessible and searchable. The product must not silently cap the actual plan just because a screen paginates. Search queries across the intended scope must not search only the rendered first page.

Chapter view: image, title, short purpose, **Continue**, then the primary lesson sequence. Short lesson rows should emphasize title, estimated duration when grounded, and progress. Optional activities have one **Practice and quizzes** disclosure or activity destination, grouped by their source lesson; they do not triple the main lesson list. Keep a directly reachable path for someone who actively wants to practice, including after finishing the chapter.

Current chapter, completed chapter, and unstarted chapter statuses should have text/accessibility equivalents. Do not show a wall of lock icons on generated public content. Do not rely solely on color for difficulty or progress.

### Course preferences editor

One entry: **Course preferences**. Show concise summary rows with current values. Opening **Learning goal**, **Starting point**, **Learning pace**, or **Activities** edits that single decision using the same explained components. Keep a sensible small list rather than a one-page form with every field expanded.

Changing Overview to Full subject must explicitly preserve completed work and reveal the expanded path. Copy: **Your completed lessons will stay completed.** Changing starting point must not award completion for skipped work. Changing activity preferences must not delete attempts or rewrite account stats. Changing scope should update the continuation target and progress denominator consistently across My courses, course/chapter pages and completion.

If the selected path changes, show the new next lesson rather than only a success toast. If an edit fails, retain the prior valid plan and the user's draft answer with a retry action.

### Completion and motivation

After an explanation, emphasize the concrete idea learned and the next short lesson. Primary **Continue** with next lesson title and grounded short duration. Secondary **Done for now**. Practice/quiz suggestion remains smaller and appears only when useful or chosen; never force it as the default next item for someone who opted out.

Avoid adding several interstitial celebration screens to an already short lesson. Keep the existing meaningful account milestones, but review whether stacked milestones delay the next lesson. A small sense of capability and a clear next step are the retention mechanism here; no new streak system, currency or punishment is needed.

Overview completion: **Overview complete** / **You've explored the main ideas in {subject}.** Primary **Explore the full course**. Do not display **Course complete** when advanced material remains. A full chosen plan ending can say **Your learning plan is complete**. Language level ending can say **B1 lessons complete**, not **You are fluent**. Question ending should acknowledge the exact question learned and offer related learning only after completion, not force another full-course onboarding.

Returning after an absence should show their next relevant lesson. No guilt message, compulsory recap, or accidental restart. Optional review can remain available in context.

### Loading, generation and access

Separate content consumption from generation in the language and state model. Anyone may open already generated public content. Authentication is needed to generate. Private content always requires its owner. An intermediate learner should be able to use their free generation allowance at a suitable B1/intermediate chapter instead of chapter one.

Recommend a simple account-level chapter-generation allowance with enough complete chapters to experience the learning loop; the exact allowance should be consolidated with cost analysis. A whole selected chapter should remain usable after it is started, including its learning activities, without a surprise paywall halfway through. Charge/reserve once at the meaningful chapter boundary; retry and concurrent requests cannot consume duplicates. A free learner browsing generated content should not be treated as generating it.

At the first generation request, state the value briefly: **Create this chapter for free**. Do not show an account quota dashboard on every course page. When the allowance is exhausted: **Keep creating with Plus** / **You've used your free chapter generation. Existing lessons are still available.** Primary **Get Plus**; secondary **Browse available lessons**. Final wording must state the actual policy clearly and must not promise unlimited generation if the paid policy has meaningful limits.

When generating: **Preparing your first lesson**. Show one honest status and an indeterminate progress indicator until there is real progress data. If background work genuinely survives navigation: **You can leave this page. Your course will appear in My courses.** Otherwise do not promise it. Start the first relevant lesson as soon as it is ready while the rest prepares; do not wait for the entire comprehensive curriculum or all chapter images if first-use content is ready.

Failure: **We couldn't prepare this lesson** / **Your choices are saved. Try again.** Primary **Try again**. Keep course identity and relevant context visible, preserve prior ready content, and give a route back to the course. Never leave the learner on an endless “almost ready” state after terminal failure.

## Apple implementation boundary

Target iPhone and iPad through the existing shared SwiftUI feature code. Existing CourseView/ChapterView/MyCoursesView should consume updated path/level/progress/continuation contracts. Use List sections for curriculum levels and native menus/pickers for concise selection. Settings belong in the existing Account NavigationStack; Interests is explicitly requested in the brief and is appropriate as a new destination within this existing account surface.

Course preferences can adapt the existing detail actions to a native form or pushed list; do not copy the web sidebar. On iPad retain native navigation and adaptive containers. No fixed-size six-level segmented control, custom persistent web headers, or dense card dashboard. Existing NewCourseView is only a placeholder; private discovery, track authoring and the unported full player are not new native implementation requirements. Existing native listings must still handle new course data safely and must not strand a learner on a broken destination.

If a new shared capability is only supported on the web, the existing Apple surface must either display it correctly at its supported depth or offer a clear supported route; it must not pretend to have a native implementation. Confirm the exact native route behavior in design consolidation before editing.

## Accessible and responsive behavior

- Questionnaire: real fieldset/legend, native radio or checkbox behavior, visible labels including Other input, associated descriptions/errors, valid focus transition, inactive questions hidden and inert. Test Back and answer preservation with keyboard only.
- Do not use letter shortcuts unless they remain harmless in a text field and are clearly announced. Standard Tab/arrows/Space/Enter must work without shortcuts.
- Mobile: use a single scroll container, safe-area-aware actions, ample touch area, and natural text wrapping. The software keyboard must not cover freeform input, validation errors or Continue. No horizontal scroll caused by CEFR labels or long translated text.
- Dialog/sheet: meaningful heading, accessible close/cancel, focus returns to the trigger. Route-based multi-step setup is preferable for deep linking, browser Back and resumption; a sheet is appropriate for a small course-preference edit.
- Loading/error: status live region with concise updates, no repeated noisy announcements or false precision. Preserve existing content during refresh and isolate retry to the failed operation.
- Images: retain chapter imagery; use empty alternative text when an adjacent title duplicates a decorative thumbnail. Give meaningful instructional images useful alternatives in the lesson content.
- Progress: label the scope and counts, e.g. **3 of 8 lessons in this chapter**. No false zero when content count is still unknown. Do not present missing/generating lessons as completed because the current denominator includes only ready material.
- Apple: verify Dynamic Type at accessibility sizes, VoiceOver labels/values, light/dark, iPhone and iPad narrow/full-width. Native row descriptions must wrap and selection must be distinct from row navigation.

## Decisions and contradictions resolved by judgment

1. Question is described as 1–3 chapters earlier but single-chapter in the later definition of done. Prefer one chapter of a few focused lessons, which satisfies the stronger late acceptance criterion and keeps narrow questions direct.
2. “Do not build new Apple features” coexists with an explicit request for global settings on Apple. Add Interests within the existing Account surface; avoid unrelated native course authoring/player/track construction.
3. “No question cap” does not mean asking indefinitely. Ask until material uncertainty is resolved, without an arbitrary count and without repeated or irrelevant questions. Unknown total means no fabricated progress fraction.
4. “Full comprehensive course” does not mean displaying every chapter on first entry. Progressive browsing and a scoped learner plan are presentation/selection, not curriculum truncation.
5. “Optional quizzes” cannot mean claiming mastery from untested skills. Separate learning progress from assessments and from CEFR competency claims.
6. Existing personalization eval cases use inconsistent classification for university maths+physics versus maths+physics+chemistry. They should not prevent a coherent multi-course Track flow. Read semantic intent and adjust affected tests with a reason.
7. A short first lesson is not permission to generate repetitive fragments. “Function body,” “function arguments,” and “function results” should remain one useful focused lesson if separate lessons cannot add distinct real capability.

## Independent review checkpoints

Do not batch all visible changes and review them only at the end. Each slice below is gated by its own rendered inspection and critique before the next major UI surface is implemented. The reviewer should receive the user problem and the running route, not an instruction to approve the implementation.

| Slice                                      | Review immediately after implementation                                                                                                        | Reject if                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Start and simple reusable setup         | Direct course and prompt entry on desktop/mobile; new/returning; existing generated content anonymous.                                         | More than one question at once, architecture jargon, redundant questions, Start skips a necessary starting decision, known learner is reset. |
| 2. Language level and course preferences   | A1/B1/C2 selected; unknown; reopen edit; progress already exists.                                                                              | Bare CEFR codes without explanations, compulsory test, preference change erases progress, excluded skills imply mastery.                     |
| 3. Private discovery and mixed subjects    | Unusual eval prompts, Other response, sign-in return, back/reload, terminal failure; physics+chemistry Track.                                  | Repeated generic questions, fabricated total count, lost draft, private content exposure, manual track organization wall.                    |
| 4. Course and chapter surfaces             | 4-chapter overview, broad full core, 180-chapter language; long names; current and completed paths.                                            | Full grid overwhelms first screen, multiple main actions, optional activities triple list, page pagination truncates actual course.          |
| 5. Optional formats and completion         | Skip/default/explained options; reading-only core; selected language skills; overview-to-full transition.                                      | Unexplained raw format checklist, compulsory opted-out activity, false course completion, 0/0 completion, stacked celebration delays.        |
| 6. My courses, tracks and global interests | Empty, one course, one track, mixed items, completed, course in multiple tracks; save/clear interests.                                         | Duplicate level/course cards, inconsistent continuation/progress, nested control maze, global goal changes unrelated course.                 |
| 7. Free/paid/generation recovery           | Any starting level; generated vs not-generated; quota boundary, retry/concurrency, paywall return; completed first lesson while rest prepares. | Generated public lessons locked, allowance charged twice, half-chapter surprise gate, endless loading, choices lost on sign-in/upgrade.      |
| 8. Native updates                          | Existing iPhone/iPad catalog, detail, continuation and account settings; Dynamic Type/VoiceOver.                                               | Web layout port, broken new data handling, truncation, false proficiency, new unported feature scope.                                        |

After all slices, run another independent product review across whole journeys. Re-read `PROBLEMS.md` and record evidence for every definition-of-done item. Builds and tests alone are not evidence that a screen feels calm or a first lesson is relevant.

## Primary research informing this proposal

The official [shadcn Questionnaire](https://ui.shadcn.com/docs/components/base/questionnaire) supports single/multiple/freeform answers, explicit skipping, controlled navigation, conditional items and resume. It uses semantic fieldset/legend, native selection behavior, associated errors and focus changes. The host owns persistence and branching. This matches the brief and avoids building an unnecessary custom questionnaire state machine. The repository already depends on `@shadcn/react` 0.3.1; verify the installed export and registry version before adding the wrapper.

Apple's [Onboarding guidance](https://developer.apple.com/design/human-interface-guidelines/onboarding) favors quickly experiencing the product, contextual explanation and deferring nonessential customization. Its [Settings guidance](https://developer.apple.com/design/human-interface-guidelines/settings), [Pickers guidance](https://developer.apple.com/design/human-interface-guidelines/pickers) and [Lists guidance](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) support sensible defaults, predictable choices and compact native hierarchy. The proposal applies those principles while preserving Zoonk's need for meaningful starting-level choice.

Duolingo's [learning-path redesign](https://blog.duolingo.com/new-duolingo-home-screen-design/) explains reducing learner planning work by making a deliberate sequence the default. Its [Birdbrain description](https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/) connects suitable difficulty and targeted repetition with engagement. The relevant inference for Zoonk is a clear next step, appropriately challenging short lessons, and review where useful. These sources do not establish that copying its visual path, streak mechanics or every design decision will improve Zoonk retention.

The repository's own product philosophy supports approachable explanation, real-world agency, personalized context and progress that survives absence. The redesign should keep those principles while replacing the old compulsory lesson order; a published description of the old behavior is not a reason to preserve the problem.

## Implementation review log

### Questionnaire primitive: static review, 2026-09-12

Reviewed the new `packages/ui/src/components/questionnaire.tsx` against the official base-maia registry and the actual installed `@shadcn/react` 0.3.1 implementation. Native selection inputs, enclosing choice labels, inactive fieldset hidden/inert state, invalid-answer focus and step navigation are preserved. Local rounded corners and restrained selected color do not change semantics. Rendered mobile, keyboard and screen-reader behavior remains pending until the first setup route uses it.

Integration findings sent to root: translated visible progress must also override the primitive's English `aria-label` and `aria-valuetext`; omit numerical progress when dynamic discovery has no known total. Navigation and Error still fall back to English inside the primitive if a caller omits children, so callers must provide translated copy. Choice content cannot contain another interactive control under the full-row input overlay. Root is itself a form and must not be nested. Persist responses through the host's controlled choice/input values or saved defaults; this installed version has no root `answers` property.

The requested design-skill principle was added as one reusable paragraph in `.agents/skills/zoonk-design/SKILL.md`. YAML/frontmatter/scaffold checks and `git diff --check` passed. The exact skill-creator Python validator was attempted but could not import PyYAML in either available Python runtime; frontmatter itself was validated with Ruby YAML instead.

### Reusable course setup: rendered review, 2026-09-12

Independently opened the running German and Computer Science setup routes in a separate browser tab, inspected desktop and 390 × 844 mobile layouts, and exercised native keyboard and branching behavior. ArrowDown selected the next language level with a visible full-row focus ring and no auto-advance. Moving to the next question focused its fieldset. Entering a custom project goal, selecting an intermediate starting point, going back to overview, and returning to the focused route preserved both answers. No console warnings or errors were observed. The pending-state correction was inspected statically: native controls are disabled while the current question remains visible. Auth return, saving and generation were deliberately not submitted in this checkpoint and still require functional verification.

The current chooser passes this visual checkpoint. Rows wrap naturally, the mobile primary action is 44 px high, and no horizontal clipping was observed. Seven CEFR rows require normal page scrolling; the clear action after the choices is sufficient without an additional sticky action. A small reduction of mobile top padding and the course-to-question gap would make better use of short screens, but compressing the choices or hiding levels would harm readability. The earlier semantic concern remains: a generic goal such as “Make something” needs a concrete project follow-up before it can reliably select suitable chapters across different subjects.

### Focused-goal refinement: regression and rendered re-review, 2026-09-12

The refinement added one concrete work/project/study detail question after the suggested goal. The first independent revisit caught an actual maximum-update-depth crash when a saved focused draft hydrated into conditional questions. Root reproduced the issue in the installed Questionnaire ref helper and applied a narrow dependency patch. The same previously crashing browser tab was then reloaded: the custom goal returned, “Make something” opened the clearly labeled “What would you like to make?” input, and continuing retained the prior intermediate starting point. The 390 × 844 layout now has a smaller top gap and ample space for the input and action. This refinement passes the rendered chooser checkpoint after the fix; auth and generation submission remain separate functional checkpoints.

### Subsequent course, chapter, generation and player checkpoints

Independent reviews continued during implementation. Course review retained chapter imagery, one Start/Continue action, a saved-path default, quiet full-course browsing, and a compact selector based on actual authored levels. Findings included misleading global chapter ordinals in a selected B2 path, selected-path progress being incorrectly reused for full-curriculum browsing, and pending/unknown lesson totals being presented as completion. Root and the owning agents corrected these. Clearly labeled local QA courses were populated from the actual generated CS and German outlines, with 150 and 255 chapters respectively and reused catalog artwork. No generation allowance was spent to create the visual fixtures. Full curricula were not truncated to fit the interface.

The course generation timeline was reduced to three honest user-facing stages rather than internal categorization/duplicate/landing-page details. Completion directs learners into setup. Chapter and lesson screens consume Core generation access and preserve a contextual exit instead of subscription-gating already generated material. Language course selection uses explicit POST actions; an ordinary GET does not create a course. Independent static reviews approved those directions and asked for honest chapter completion copy and contextual recovery links.

The chapter now lists primary teaching lessons, with one collapsed Optional practice section at the bottom. Source-specific checks and scenarios are explicit actions. Independent review corrected small touch targets to at least 44px, removed a misleading blanket statement that each activity spends an allowance, and preserved exact source anchors through sign-in and generation recovery. A live authenticated QA chapter showed two primary lessons and optional actions only for its generated source; visiting the exact source anchor opened the disclosure. Existing review lessons are being retained in that same section rather than disappearing from the product. Multiple reviews require distinct labels.

Player saving was independently inspected in code and actual Chrome screenshots at 414px. The final teaching content stays visible while progress saves, one disabled Saving progress action communicates the pending state, and failure offers one Retry save action. Reward and milestone screens wait for an authoritative receipt; retry reuses the captured attempt. The pending and failure screenshots passed the visual review. A real seven-step authenticated QA lesson completed and navigated to a confirmed completion screen with the next primary lesson. Its newly introduced localized progress sentence initially rendered placeholders because Player translation had not yet run; this was reported to the content owner for the final i18n pass. The lesson client also needs a lesson-ID remount boundary so host completion/superseded state cannot leak across lessons.

### Discovery, settings and library checkpoints

The first actual discovery question for a photographer using Lightroom, external drives and unreliable internet asked which Lightroom setup was in use. The supplied 780px screenshot passed: one material question, a short rationale, explained choices, Other, and one Continue. A merged “Both or unsure” choice needs a clarifying follow-up when its ambiguity remains material. Later prompt review distinguished facts the learner must supply from expert decisions the course should teach. The revised saved probe reached a useful brief after three material answers and chose sensible, explicitly identified teaching defaults instead of asking a novice to design a backup system.

The discovery ready screen was independently reviewed after an answer revision. Its separate learning-goal paragraph repeated the title and description; removing that paragraph from presentation was recommended while retaining the underlying learning goal. The requirements and description should preserve material equipment, starting-point and connectivity assumptions so learners can verify the proposed experience. Static recovery review confirmed distinct conflict versus transient-failure wording, contextual Change answer accessible names, Cancel restoring focus, and a shared transport wrapper that preserves Next.js redirects. In a separate authenticated QA browser, another owner's actual discovery UUID returned the real 404 screen with no request, answer, title or brief disclosure.

Per-course preferences were reviewed before implementation. Six sequential keep/skip questions were rejected as excessive friction for a reversible activity mix; the agreed design uses one optional daily commitment question, Recommended/Choose, then one group of six explained choices. In the live authenticated browser, keyboard selection, Back, saved choices, and reopen all worked. Review caught both a false required error during disabled submission and a false generic failure after a successful redirect. Root corrected those; a repeat save retained checked values while pending, showed no false error, and navigated to the saved B2 path. Decorative spinner accessibility was also corrected. The latest PROBLEMS note explicitly forbids notifications when a daily commitment is exceeded; the pause suggestion was removed and the copy now treats time as an editable commitment.

Fresh reconciliation of PROBLEMS line 387 found that free-text-only Interests did not satisfy the explicit selectable-list requirement. Main and Apple are being updated with the same eight canonical English human values (Technology, Sports, Science, Fashion, Science fiction, Photography, Music, Cooking), localized display labels, icons, and a separate custom multiline field. Existing case-insensitive exact matches are recognized; custom entries remain editable. Main's actual desktop view and keyboard Space selection passed. Its duplicate empty checkboxes in the diagnostic snapshot are Base UI's aria-hidden, non-focusable form inputs; the visible checkbox roles have correct names and state. A real save retained both selected and custom interests and announced success. Native final verification is still in progress at this checkpoint.

Track review retained one ordered Continue action, course links, and a quiet edit surface. Review requested stable focus after boundary reorders/removals and distinct recovery messages; root implemented those refinements. The native library shows one Track row with a course count and an external-link indicator, followed by standalone courses without duplicating Track members. Pagination and session-scoped late-response behavior have store coverage. Track rows open the existing web detail; native authoring is outside the stated Apple scope.

### Apple implementation and evidence ledger

Existing Apple course, chapter, My Courses and Account surfaces now use authenticated API resources, explicit private-course routing, saved paths, actual levels, full-curriculum progress, per-course preference links, and global Interests. Private course ownership and session identity scope each asynchronous read; old-account state is cleared. Native setup and unported generation remain honest web links. Stale focused plans cannot choose a fallback chapter. Unknown/pending chapters do not claim 0/0 completion. Optional practice is source-specific and uses the Core eligibility response, with web links only for available source material.

Root independently reviewed the actual iPhone course and iPad path/Interests/chapter/library screenshots at each significant surface. Review removed repetitive Not started badges from untouched chapter rows. A final largest Dynamic Type and Increased Contrast pass caught two real issues: wrapped Track titles were centered and secondary content inherited a faint link tint; and a fixed course/chapter header compressed into overlapping content above the List. Track text now aligns left with semantic secondaryLabel contrast. At accessibility text sizes the detail header and curriculum controls scroll inside the native List. Root independently reviewed the corrected largest-text screenshots and the pending chapter's single Open chapter on web action. No overlap or false completion remains in those observed iPad screens.

Verification completed before the final Interests-list increment: a containing native run passed all 204 then-current unit tests; three existing course/chapter/My Courses UI tests initially failed because their fixtures asserted obsolete required practice, Not started badges, and disabled private-course navigation. Those fixtures were reconciled with the intended behavior and all three UI tests passed in the subsequent run, together with CourseCatalog API/store tests. Native builds passed after the accessibility corrections. Compiler-driven String Catalog synchronization, the repository translation command and strict localization lint passed for the earlier changes. New Interests-list and optional-review changes require a fresh build, containing unit checks, translation/lint and rendered iPhone/iPad verification before native completion.

The browser's viewport override stopped applying in the later shared runtime (requested 390px while the actual DOM remained 1694px). Therefore the initial setup mobile review and supplied 414px player screenshots are valid evidence, but later Preferences/Interests mobile verification must come from actual E2E viewport screenshots or a functioning browser override. Desktop snapshots alone are not being called mobile evidence. API profile/Track HTTP suites remain the root's shared-build validation lane; earlier API typechecks do not establish those HTTP flows.

### Final journey audit and corrections

Re-read the complete PROBLEMS brief during the final audit. The real combined request “I want to learn physics and chemistry” created a correctly ordered Track with one existing Physics course and a deferred Chemistry member. The rendered screen has one Start action, an ordered list, and quiet Edit track; editing announced reordered positions, retained focus, saved the original order, and preserved the pending member. This journey exposed a material gap: Track Start silently selected a default beginner path for a new reusable member. Core now returns `needsPlan` before that start, and Main reuses the existing course setup. The actual Track Start then opened the explained Overview / Full subject / Goal choice without generating an outline. Existing saved members continue, and generated pending members retain their Track binding before entering the same setup. A new Main E2E covers two successive reusable members, real first-lesson completion, preserved grouping and no generation claims; it awaits the shared rebuilt suite at this checkpoint.

Another final continuation audit found that a guest explicitly taking the full subject, or someone browsing outside a saved subset, could be sent to the first default/selected course lesson. The precise defect was verified against the prior implementation: both the guest full-subject test (incorrectly returning to the default Overview) and the manual-chapter test (skipping the next lesson within that chapter) failed. Restoring the fixed implementation made all 12 path-consumer tests pass. The successor infers the actual chapter's level path only when the current/source lesson is absent from the saved/default path, while retaining the stale-focused-plan guard and leaving the saved plan unchanged. The Overview same-chapter/next-chapter/final-boundary test is an unchanged-behavior guard, not evidence of this defect; guest B2 was likewise already included in the default comprehensive CEFR sequence. Root added a complete three-chapter guest Overview browser regression. The full Core suite had already passed 113 files / 841 tests against the same implementation; the added precise guest Full regression was then included in the focused 12-test pass.

The guest pre-lesson warning was rejected as a redundant barrier after meaningful setup. Guests now enter generated teaching directly and receive honest sign-in conversion after completing a lesson. The shared completion action owns that conversion so optional practice cannot replace it. Review caught a keyboard hazard in the existing global Enter shortcut taking precedence over focused links; the Player owner reproduced and corrected it with browser coverage. Replay copy now says “Repeat lesson” rather than ambiguous “Try again” or “Review.” Question completion remains visually calm with one exit, a secondary replay and collapsed practice. Private chapter ratings that only changed local state were removed instead of falsely thanking learners for feedback that was discarded.

The scoped Lightroom tutorial sample was independently checked against current Adobe documentation. Its six short steps identify the active catalog and conditional `.lrcat-data` companion, then verify the result without spilling into neighboring photo-folder, cache or recovery-priority lessons. Adobe's [catalog instructions](https://helpx.adobe.com/lightroom-classic/desktop/manage-catalogs-and-files/create-catalogs.html) confirm Catalog Settings → General → Show, and its [catalog FAQ](https://helpx.adobe.com/lightroom-classic/desktop/technical-support/workflow-issues/catalog-issues/catalog-faq-lightroom.html) explains the companion's important editing data. This sample is evidence for a scoped tutorial, not a guarantee about all generated lessons.

Final Apple evidence advanced to a fresh full 207-unit-test pass, followed by 55 API/store tests for the empty-course eligibility correction and 17 API tests including authored optional reviews. A subsequent full run against the new supportsLearningPlan client passed all 209 unit tests. A first eligibility test failed because its successful response fixture was incomplete; the corrected valid public-contract fixture passed. Compiler-marked stale entries were removed automatically, normal String Catalog formatting retained, translation and strict localization lint passed, and all 35 changed Swift files passed strict formatting lint. The latest build passed after adapting an OpenAPI argument-order change. The subsequent `supportsLearningPlan` capability field is now mapped from the regenerated API client and a fresh Apple build passed. Existing authored legacy courses suppress unavailable path/preferences controls and start their real teaching content; reusable modern courses preserve the guided setup.

Actual final iPhone screens were inspected in Portuguese, dark appearance and the largest Dynamic Type size. Interests labels, toggles, custom input and Save/Back remained readable and reachable through normal scrolling; root independently approved those screenshots. The course's native CEFR menu selected B2 correctly, and the pending B2 chapter showed one capability-backed Open chapter on web action with no false 0/0 completion or unavailable practice choices. Largest-text course/chapter content scrolls inside the List. The iPad reread the current API successfully: one Track row and standalone courses without duplicated members. Main and native both reopened the same saved Technology, Science fiction, Photography and custom “Native QA gardening” values after an actual native save. Native keyboard/accessibility names and Dynamic Type were inspected; a full spoken VoiceOver tour was not performed.

The independent signed-in QA account also opened the root QA owner's actual newly generated private Lightroom course URL and received only the course-not-found surface, with no private title or chapter disclosure. Public/private share metadata and broad final mobile screenshots remain in root's final validation lane; this review does not mark the whole source brief complete before those checks finish.

### Final illustration failure and accessibility correction

Actual lesson inspection found image-generation instructions being used both as screen-reader alt text and as the visible placeholder when an illustration failed. This is a confirmed user-facing leak of production scaffolding. Before implementation, root independently approved the interaction: successful art keeps the contained layout and uses a separate concise description; missing or failed optional artwork uses the existing complete text scene without a placeholder, empty media column or new action. Legacy images use the nearby title/question as a limited contextual alternative; new generated descriptions preserve the actual teaching relationship. Image answer options remain a separate interaction.

A real Chrome regression first failed because the missing image displayed “Draw a diagram. Do not add decorative objects.” The fix removes that placeholder. Further coverage caught a missing desktop Check button when failed contextual practice artwork collapsed into the text scene; retaining its existing scene-owned action fixed that. Three new browser tests cover descriptive alt, missing/failed artwork, navigation to a later successful image, and answer submission after contextual image failure. The final containing Player suite passed all 43 files / 383 tests; Player typecheck and owned-file lint/format checks passed. Actual screenshots were captured at 390×844 for the text fallback and 1280×720 for the recovered practice question and sent to root for independent review.

The first-visit private illustration screenshot confirmed that useful art is present before the learner enters the lesson, without a reload. Independent image review also caught an inaccurate folder arrow and a fabricated realistic product UI. The revised synthetic probe uses a three-object file→folder→drive schematic with a separate semantic description, while its five-step tutorial uses Show in Finder and checks for missing/offline originals. No additional paid raster generation was required to verify the corrected text and selection contract.

### Final source cleanup and review state

A final source-wide check found no remaining daily-target reached/pause notifications or subscription/chapter-one gates in the changed Main/Player course-generation surfaces. One obsolete direct route, `/p/[courseId]`, still displayed “Personalized courses are coming soon.” This was reproduced in the live browser before the change. It now validates the UUID and resolves the caller-scoped Core course capability, redirecting only the readable owner's private course to its canonical URL. Other owners, guests, invalid IDs and nonprivate courses receive the generic not-found surface. Root independently reviewed the implementation. Two actual Main E2Es were added for the owner redirect/privacy boundary and invalid/public IDs; they are part of the upcoming full rebuilt suite.

Root independently reviewed the final illustration recovery screenshots: the 390px text fallback has no prompt or empty artwork reservation; the desktop practice fallback keeps Check; successful artwork remains contained. The final Apple containing suite passed 209 tests. Main's final 390px Preferences/Interests screenshots and full rebuilt browser run remain outstanding at this checkpoint; none of the earlier static or focused checks are being used to claim those journeys complete.

### Containing Main run and final mobile review

The first final containing Main browser run completed with 396 passes and 45 failures out of 441. It did not establish completion. Independent triage distinguished obsolete assertions and malformed fixtures from reachable product defects. The Track journey used a static teaching fixture missing its required text variant; other Track assertions counted hidden cached-route text or required an exact course-link name that omitted its visible description. Those tests now preserve the intended user assertions, including actual saved progress, the next member's setup, no generation charge, and persisted removal of the pending Track subject. Language selection coverage now expects the deliberate POST button for a missing course.

The exact language bookmark exposed a separate freshness issue. A durable API workflow can finish after Main's completion observer closes, so the cached language-picker list can remain stale even though the public course exists. The direct `/start/speak/[language]` GET now reuses Core's existing uncached completed-course lookup; it still performs no generation or mutation, while the picker retains its batched cache. The regression intentionally warms the picker before inserting the completed workflow result and expects the existing course's CEFR setup without generation. Architecture and root independently reviewed this bounded correction. Its rebuilt browser verification is pending at this checkpoint.

Focused-path course cards were also confirmed to reorder the learner's selected chapter sequence into global curriculum order. The Main correction maps the selected IDs in the authoritative path order; full-curriculum browsing retains authored order. This passed independent static review. Apple already maps the same ordered path IDs, and its full 209-test run includes a deliberately reversed selection regression. The shared explicit Continue adapter now consults Core generation availability rather than fabricating a completed state for every legacy target; available teaching stays directly readable and unsupported authored content is not sent to generation.

The actual 390×844 Interests screenshot passes independent visual review: the eight icon choices, optional custom input, saved status and single Save action are readable without horizontal clipping. The first Preferences full-page capture showed its sticky navbar at an interaction scroll offset and cannot establish its true viewport hierarchy. The test now scrolls to the observed document top and captures both the actual 390×844 viewport and the full page. Those corrected captures and the rerun of the affected Main journeys remain required before this review accepts the mobile Preferences state.

The final synthetic chapter-boundary probe resolves the observed classification/list repetition: locating the active catalog, locating an original photo, and deciding then recording recovery priorities are three distinct practical capabilities. Recording the priority list stays with the decision it documents instead of repeating its rationale in a separate lesson. This is a reviewed synthetic outline, not a claim that previously generated QA lessons were replaced or that every generated lesson is guaranteed correct.

The corrected Preferences captures now pass independent mobile review. At the actual 390×844 viewport, the navbar sits at the top, Back to course and the Learning preferences/course hierarchy remain clear, the six explained choices wrap cleanly, and normal scrolling reaches the final choice, completion caveat, Back and Save. The full-page capture confirms all content is present without overlap. The earlier apparent navbar displacement was a full-page capture at a scrolled sticky-header offset; no product-layout change was warranted. Root reports the complete free-learner B2 preference save/reopen test passed in this rerun. Review evidence is preserved at `/private/tmp/zoonk-preferences-final-mobile-viewport.png` and `/private/tmp/zoonk-preferences-final-mobile-full.png`.

Final independent navigation review approved two narrow recovery fixes. Legacy learning-request bookmarks now preserve their encoded suffix through next-intl's rewrite/locale redirect, keeping the middleware-selected origin, locale and query rather than malformed percent escapes. Actual independent browser journeys recovered the exact editable drafts “Learn what %20 means in a URL” and “Learn paths / and 50%,” with focus in the input and no generation. HTTP alternate links are removed for those legacy private requests. Separately, the confirmed production hydration mismatch came from different randomized suggestion subsets in prerendered HTML and the runtime RSC response. A fixed set of five varied subjects preserves the existing visual/navigation model and the animated placeholder; independent static and development-browser review passed. Its production regression awaits the rebuilt root run.

### Final independent reconciliation against all 18 completion criteria

The complete current `PROBLEMS.md`, including the final daily-commitment and explained-choice notes, was reread for this reconciliation. No additional concrete UI/UX gap was found in the changed surfaces and journeys reviewed. This does not override the outstanding containing Main verification gate.

| Criterion                                     | Current intentional answer and review boundary                                                                                                                                                                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Four coherent course formats               | Reusable core and CEFR courses have learner paths; narrow Question courses and owner-private courses retain their own appropriate scope. The learner chooses an outcome rather than a database format.                                                                                          |
| 2. Comprehensive curricula and scoped paths   | Overview is deliberately short; the full generated core curriculum remains available, and a saved path can be changed. Real large CS/German outlines and full-curriculum browsing were inspected.                                                                                               |
| 3. Clear CEFR and non-beginner entry          | Explained A1–C2 choices, actual-level browsing and B2 starts are present on Main; existing Apple catalog surfaces show the same level/path semantics through native controls.                                                                                                                   |
| 4. Private discovery and cost                 | Material questions, resumable corrections, a reviewable brief and private ownership precede generation. Actual private requests and other-owner denial were exercised; model/image selection is separately reviewed in the content lane.                                                        |
| 5. Single-chapter Question experience         | Question uses one short chapter with focused teaching and a quiet completion state. Root exercised the actual generated Question journey; its completed screenshot was independently reviewed.                                                                                                  |
| 6. Appropriate starting point and sequence    | Scope, starting knowledge and a concrete focused goal select the reusable path. Track members now enter that same setup. Confirmed out-of-path continuation and focused-order defects were corrected with discriminating regressions.                                                           |
| 7. Short approachable teaching                | Reviewed actual/synthetic samples teach focused capabilities with plain examples. Repeated classification/list rationale and inaccurate procedural commands were corrected. Samples cannot establish that every future generation will be correct.                                              |
| 8. Intentional quiz/practice                  | Teaching is primary; checks, scenarios and authored reviews sit in one collapsed, source-specific optional section and do not control required completion.                                                                                                                                      |
| 9. Relevant first lesson with little friction | One Start/Continue carries intent through required generation; cached guest teaching opens directly. Meaningful course choices remain, while repeated creation confirmations and the guest warning wall were removed.                                                                           |
| 10. Guest/free/paid experience                | Guests consume generated teaching; authenticated generation uses chapter allowances at the chosen level. Recovery keeps existing material accessible. Core/API access coverage and Main containing reruns remain the authority for the complete state matrix.                                   |
| 11. One list entry per course                 | Levels stay inside a course. My Courses groups Tracks and standalone courses, with pagination; native library uses the same distinction. Actual list and Track journeys were inspected.                                                                                                         |
| 12. Preserve durable history                  | Revision-aware replacement and detached historical metrics avoid erasing earned account history. The UI distinguishes selected-path completion from historical achievements. Migration/database proof belongs to the backend ledger; no production migration was performed in this review.      |
| 13. Future restructuring                      | Saved plans reference the current curriculum revision; stale focused paths require recomputation rather than silently choosing unrelated content. Unsupported authored legacy courses expose only the path controls they can fulfill.                                                           |
| 14. Existing Apple surfaces                   | Course, chapter, library and Account adapt to the shared behavior through native Lists, Forms, menus and semantic colors. Unported setup/player/generation remain explicit web destinations. iPhone/iPad and largest-text screens were inspected; final native build and 209 unit tests passed. |
| 15. Meaningful coverage and checks            | Still a completion gate: root is rebuilding production after the last proxy/hydration changes, then running the affected journeys and the full Main containing suite. Earlier failed containing runs are not being counted as success.                                                          |
| 16. Calm UI                                   | One primary action, explained reversible choices, progressive disclosure and chapter imagery are preserved. Actual 390px Preferences/Interests, course/player screenshots and native layouts passed the described independent checkpoints.                                                      |
| 17. Independent review during work            | Every meaningful final UI slice has an after-review, as recorded below; confirmed findings were corrected before moving on. Late navigation-only fixes also received static and actual-browser review where applicable.                                                                         |
| 18. Full source reconciliation                | Each problem has an intentional implementation answer. This reconciliation found no new concrete missing UI behavior; completion remains conditional on criterion 15 and any findings from that final run.                                                                                      |

After-review coverage includes the Questionnaire primitive and conditional-draft repair; reusable setup and concrete-goal refinement; selected/full course views, empty legacy states and explicit continuation; course/curriculum/chapter/lesson generation handoffs; primary/optional chapter content; authoritative Player saving, guest conversion, keyboard actions and image recovery; private discovery questions, corrections and error recovery; Track/library editing and member setup; per-course preferences and global Interests; and every changed native course/chapter/library/Account surface. Root independently reviewed changes authored by this UX agent, including native visual increments, Player artwork recovery and the private bookmark redirect. The fixed suggestion set and legacy encoded-request recovery also received their final after-review.

Material limits remain precise: the final production Main affected/containing runs are not yet complete at this checkpoint; the repeat Track fixture-isolation check must pass; the independent reviewer did not perform a full spoken VoiceOver tour or test every locale and iPad multitasking width; generated-content review used selected actual and synthetic examples rather than an exhaustive promise about future model outputs; and no production deployment, production migration or retention measurement is claimed. The latter limits describe the evidence boundary, not additional speculative feature work. No source change or extra screen is proposed solely to eliminate them.

### Last legacy-bookmark production correction

The subsequent production subset passed 53 of 54 tests, including hydration, the three B2 states and repeated Track coverage. One legacy percent bookmark still failed in Next's internal production prerender matching before the old page ran; the earlier middleware suffix repair was therefore insufficient despite its unit/development passes. The final recovery now redirects the legacy URL to the clean localized Learn page with a temporary encoded request fragment, then saves the draft and removes the fragment from browser history. The obsolete dynamic spinner page was removed. Current request entry continues to use session drafts without fragments.

This final interaction received independent pre- and after-review. Source inspection confirmed the trusted origin, locale, query and locale cookie handling, private/no-store response, one defined decode boundary, incoming-draft precedence, and history-state preservation. The entire Learn route is already excluded by client telemetry filters while its fragment is being consumed. Actual independent development-browser journeys restored “Explain 100% paths / # + and literal %20” and “Literal %20 and %2F” exactly, with the incoming bookmark replacing an older typed draft. The final address was clean, focus stayed in the editable input, and reopening retained the recovered text. No extra confirmation or generation was introduced. Root reports all 30 proxy tests pass; the fresh production run remains the final gate. Repeated Track isolation is now verified in the reported 53-pass subset and is no longer an outstanding review limit.
