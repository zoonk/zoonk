# Zoonk course architecture and learning experience redesign

## Objective

Redesign Zoonk's course architecture and learning experience end to end.

The current course model is too rigid. It assumes that most learners want the same comprehensive beginner-to-mastery journey, starts everyone from roughly the same place, and forces the same lesson structure regardless of their goals.

I want a system that can serve very different learning intents while remaining simple for learners and economically sustainable for Zoonk.

The result should make this promise feel credible:

> Anyone should be able to learn almost anything in a simple, practical, motivating, and enjoyable way.

This is a product, UX, architecture, content-generation, and implementation task. Do not treat it as merely a schema migration or curriculum-generation change.

You are authorized to make substantial changes to the existing architecture, data model, generation pipeline, prompts, navigation, onboarding, and UI when they improve the overall solution.

Carry the work through implementation, testing, and review. Do not stop after producing a proposal or first implementation.

Do not commit anything. I want to review all changes locally first.

---

# 1. Understand the problem before choosing the solution

Today Zoonk has two implemented course formats:

- `language`: language-learning courses
- `core`: comprehensive courses intended to go from beginner to mastery

We have also discussed but not yet implemented:

- `personalized`
- `question`
- exam preparation

Exam preparation is **out of scope for this task**.

This task covers:

- `core`
- `language`
- `personalized`
- `question`

Before changing code, understand the existing implementation, generated course data, prompts, relevant tests, current UI, and actual user flows well enough to make informed decisions.

Also read relevant Zoonk blog posts in our `blog` app to help you understand our learning philosophy and long-term product direction.

Do not assume the current architecture needs to be preserved.

---

# 2. Product problems we need to solve

Treat the following as the underlying problems. Solve the problems rather than mechanically implementing my suggested solutions.

## 2.1 One-size-fits-all courses

The current `core` format mostly makes sense for someone who:

1. knows little or nothing about a subject, and
2. wants a comprehensive beginner-to-mastery curriculum.

That is only one learning intent.

Many users instead want a quick but meaningful overview a subject: something deeper than a TED Talk but much smaller than an academic curriculum.

Others enter very specific prompts that cannot sensibly fit into a generic reusable beginner-to-mastery course.

The system needs to distinguish these intents.

## 2.2 We don't understand the learner's goal

Today we can start generating content without understanding enough about the learner.

Useful information may include:

- why they want to learn it
- what outcome they want
- their existing knowledge
- how deeply they want to learn it
- how much time they want to spend
- preferred learning formats
- specific topics they care about (eg sports, sci-fi, tech, politics, fashion, etc)
- topics they already know or do not care about

Someone asking to "learn Python" for a new job may need a very different journey from someone studying programming fundamentals at university.

Someone willing to spend five minutes per day needs a different experience from someone studying intensively.

Design a system that learns enough to make good decisions without turning onboarding into a long questionnaire.

Prefer low-effort selectable answers when appropriate, with an `Other` path when users need to explain something unusual.

## 2.3 Starting level

Not everyone should start at the beginning.

Core learners may already be intermediate or advanced.

Language learners particularly need better visibility into CEFR levels:

- A1
- A2
- B1
- B2
- C1
- C2

They should not effectively be forced to begin at A1.

Consider whether placement or leveling mechanisms are appropriate.

## 2.4 Personalization versus reusable content

Reusable content is economically important.

For reusable courses we can justify:

- stronger/more expensive models like gpt-5.6-sol and/or the latest gpt-6-astra
- generate more images, which improves UI and helps learner visualize the concept (right now we generate one image per lesson step but maybe we can reduce this to lower costs? and figure out which steps actually need an image? not sure, though, because users like images and they make the UI look nicer. So, if we reduce them, we'd need to ensure the UI doesn't look boring)
- significant investment in content quality

Personalized content has different economics.

Personalized content should generally:

- use a cheaper model such as `5.6-luna`
- use images only when they materially improve understanding because images are the most expensive economic unit here
- generate content specifically for the learner
- avoid generating expensive reusable-style assets unnecessarily

A strong architecture may combine reusable content with personalized selection, sequencing, framing, or augmentation.

For example, a learner could receive a personalized path through reusable chapters instead of requiring an entirely unique course.

That is only an example. Choose the architecture that best solves the problem. Personally, I think we can combine both: some prompts may get away with customizing reusable courses to tailor needs but, at the same time, very specific prompts might require a super tailored curriculum that shouldn't be reusable. Have a look at prompts users typed in the test cases we have in our evals app.

## 2.5 Lesson structure is too rigid

Currently we often force an:

`explanation → quiz → practice`

sequence.

Not every learner wants that.

Some dislike quizzes or practice entirely.

Explore whether explanation should be the primary lesson and whether quiz/practice should instead become optional ways to:

- test knowledge
- apply the concept
- explore practical scenarios
- revisit a skill

Do not automatically implement that suggestion. Find the cleanest learning model and UX.

Avoid cluttering the lesson list with unnecessary items.

## 2.6 Lessons feel too difficult and intimidating

Even introductory content can become unnecessarily technical.

This is a major product problem.

A learner without a technical background should be able to begin learning topics such as:

- general relativity
- quantum physics
- computer science
- economics

without immediately feeling that the material is "not for them."

Content should use:

- plain everyday language
- intuitive explanations
- relatable examples
- practical contexts
- progressive complexity

Do not confuse simplicity with inaccuracy.

The goal is to make difficult ideas understandable without making the learner feel stupid.

An introductory experience should create the feeling:

> "I can actually understand this."

It shouldn't use formulas or complex technical details. Those are more advanced chapters. But even more advanced chapters should feel intuitive, use plain everyday language, and practical.

## 2.7 Lessons are too long

Language lessons tend to be completed quickly.

Core lessons take longer, which may be hurting engagement.

Lessons should generally take **less than four minutes** to complete.

Shorter is usually better. Ideally, users should be able to complete them in 1-2 minutes.

Prefer several focused lessons over one lesson that tries to teach too many concepts.

There is **no fixed maximum number of lessons per chapter**. A chapter should contain however many short lessons are needed to teach its concepts properly.

## 2.8 Learning should reflect an AI-native world

Do not assume traditional curricula are always the best way to achieve a learner's goal.

For example, someone learning Python to work professionally today may benefit more from learning:

- how to reason about software
- how to work effectively with AI agents
- debugging
- architecture
- verification
- reading and modifying code

than from memorizing syntax.

Someone who explicitly wants computer science fundamentals may still need the traditional fundamentals.

The curriculum and path should reflect the learner's actual outcome. We should figure out a way to have a curriculum that can satisfy different goals.

Apply this principle beyond programming.

## 2.9 Retention and motivation

Retention is currently poor.

Even users who complete many lessons stop returning.

The learning experience should encourage learners to:

- start their first lesson quickly
- finish the current lesson
- want to continue to the next one
- see meaningful progress
- return later
- feel increasingly capable

Study the principles behind products with strong learning engagement such as Duolingo, but do not blindly clone their mechanics.

Motivation must influence the course architecture and UX, not be added afterward as superficial gamification.

---

# 3. Course types

Design a coherent architecture for these four course types.

## Core

Reusable courses for normal subjects.

The complete reusable curriculum should still be capable of taking someone from beginner to mastery.

Do **not** interpret this redesign as a request to make comprehensive courses smaller.

Instead, make it possible to expose the right subset and depth to each learner, maybe adding levels like overview/basic/intermediate/advanced.

A broad course may still contain many chapters.

There is no arbitrary chapter limit for comprehensive reusable courses.

## Language

Reusable language curricula organized according to CEFR:

- A1
- A2
- B1
- B2
- C1
- C2

Do not apply generic `overview/basic/intermediate/advanced` labels to language courses.

Language courses can remain very large. A complete language curriculum may reasonably contain roughly 150–200 chapters.

Improve how level and progression are communicated, and solve the problem of learners already knowing some of the language.

## Personalized

Courses generated specifically for one learner's unusual or highly specific requirements.

These may require AI-generated follow-up questions before generation so we can understand exactly what the learner wants.

The questionnaire should be dynamic rather than a huge generic form.

Ask only questions whose answers could materially improve the generated course. Don't add a limit to the number of questions, though. It's important that we understand exactly what they want and need here.

Personalized courses:

- require authentication because their preferences/content are user-specific
- should optimize generation cost
- should normally use a cheaper model such as `5.6-luna`
- should generate images only when they materially improve understanding. for example, we charge $9/month and images can cost around $0.008 per image
- can have whatever length is appropriate for the request
- do not need to follow the reusable core curriculum structure when that structure does not fit

## Question

A reusable micro-course intended to answer or teach a narrow question.

It should be very short:

- 1-3 chapters
- a small number of short lessons

Treat it as a learning experience rather than merely returning a long AI answer. Language should always be plain everyday language and simple to understand. Imagine how a YouTuber would try to explain this to a wide audience.

---

# 4. A possible model for core courses

One idea is to organize reusable core curricula into:

- Overview
- Basic
- Intermediate
- Advanced

This is a **design hypothesis, not a requirement**.

An `Overview` could be a 3–6 chapter pocket course intended for someone who wants useful conversational understanding rather than mastery.

It could:

- use everyday language
- avoid formulas and deep technical details
- move from intuitive basics toward interesting more advanced ideas
- emphasize relatable examples
- help someone understand enough to discuss the subject intelligently

Basic, Intermediate, and Advanced could then provide increasingly comprehensive learning.

If you find a better structure, use it.

Whatever model you choose must solve:

- different starting levels
- different goals
- different desired depths
- short introductory learning
- comprehensive learning
- reusable content
- personalization of the learner's path

The complete reusable curriculum should remain comprehensive.

---

# 5. Personalizing reusable courses

Explore how much personalization we can achieve without generating an entirely unique course.

For example, after learning the learner's:

- goal
- current knowledge
- desired depth
- available time
- preferred formats

the system might select an appropriate subset or sequence of reusable content.

AI could potentially map a learner's goal to the most relevant existing chapters.

Users should also be able to change course-specific learning preferences later. Onboarding choices must not permanently lock them into a path.

Avoid global settings that accidentally affect every unrelated course when the preference logically belongs to a particular course.

Some preferences may reasonably be global, especially interests useful for personalized examples, such as but not limited to:

- technology
- sports
- science
- fashion
- science fiction

We should show a list of interests they can select from, but also allow them to add their own. The list should look nice (eg use icons for each interest) and be easy to navigate.

Decide carefully which settings should be global and which should be per-course.

Do not expose every internal personalization dimension as a visible control. The UI should remain simple. For global settings, we should have pages that allow them to update those settings any time in the profile routing group and also in the `apple` app.

---

# 6. Entry experience and conversion

Do not immediately dump a new learner into the first lesson without understanding their intent when doing so would produce a poor experience.

At the same time, avoid creating an onboarding wall.

Optimize the entry experience for one key outcome:

**getting the learner into a relevant first lesson with as little friction as possible.**

Consider all entry paths, including:

- entering a learning request
- navigating directly to an existing course
- unauthenticated users
- authenticated free users
- paid users
- returning users
- users who already have progress

The course page itself may need to participate in onboarding/personalization so direct navigation still works well.

Users should see each course only **once** in course lists. Do not create separate list entries for every level or pathway.

---

# 7. Free versus paid access

Currently we expose the first chapter for free.

That can conflict with learners who should start somewhere other than chapter one.

Redesign this if necessary.

For example, generation/access limits based on chapters or lessons might make more sense than literally making only the first chapter free.

That is only a hypothesis.

Find a model that:

- allows an appropriate starting point without requiring a subscription
- provides enough value to understand the product
- has a clean upgrade moment
- behaves sensibly across different course types
- does not make the UX confusing

Evaluate unauthenticated, free, and paid states separately.

Unauthenticated users should be able to consume already generated content but not generate new one. Free users should be able to have the same experience as paid users, including content generation, but have limits on how much content they can generate. It should be enough for them to actually get engaged with the product, though. That's why currently we give them access to a whole free chapter.

---

# 8. UI/UX principles

UI/UX quality is one of the highest priorities in this task.

The previous attempt produced a cluttered interface. Do not repeat that.

The UI should feel:

- simple
- calm
- focused
- intuitive
- polished
- easy to start
- low-friction

Think more like Apple than an enterprise dashboard.

Do not solve complexity by putting every setting and action on one screen. The main UX principle is "Don't make me think."

Use progressive disclosure where appropriate.

A learner should not have to understand Zoonk's underlying course architecture in order to learn.

Before implementing a significant UI change, decide what interaction model best solves the learner's problem rather than simply adding another control to the current page.

Pay attention to:

- hierarchy
- information density
- empty states
- loading/generation states
- error states
- mobile layouts
- accessibility
- copywriting (should be clear, not clever)
- upgrade states
- returning learners
- partially completed courses
- different course formats

Keep labels and copy simple and human.

For every important screen, ask:

- What is the learner trying to do here?
- What is the primary action?
- What can be hidden until needed?
- Is anything asking the learner to make a decision the product could make for them?
- Is this screen understandable without documentation?
- Does this make the learner want to continue?

---

# 9. Curriculum requirements

These are hard requirements regardless of the architecture you choose.

## Comprehensive courses remain comprehensive

Do not shorten the complete reusable curriculum simply because many learners want shorter paths.

Someone who wants mastery should still be able to progress from beginner to advanced - and even users who start with a short path must have an option to change their mind and do the full mastery path.

Organize and personalize the curriculum instead.

## Multiple courses

Sometimes users combine multiple topics in the same prompt (see test cases in eval results). For example: physics and chemistry

When they do something like that we should figure out a way to suggest both courses separately but also create a new "Track" concept where they could group multiple courses together and follow the track progress. My courses should have a way to display those tracks along individual courses in a clean and clear way.

## No arbitrary chapter limits

Except for a deliberately short format such as Overview and Question, do not impose arbitrary limits on the number of chapters.

Broad subjects need enough chapters to cover them properly. Having lots of chapters also allow us to better personalize reusable courses.

## No arbitrary lesson limits

A chapter may contain however many lessons are needed.

Optimize for short lessons rather than fewer lessons.

## Lesson scope

A lesson should usually teach one focused idea or tightly related group of ideas.

If a lesson becomes long because it contains several concepts, split it.

but be careful to avoid lessons covering the same concept/idea multiple times. For example, in the past when we tried this, AI models would create lessons like "function body", "function arguments", "function results", etc. those are annoyingly repetitive.

## Chapter imagery

Continue generating chapter images/thumbnails for all generated chapters as we do today.

## Content quality

Explanations should be:

- correct
- approachable
- engaging
- practical
- relatable
- concise enough to sustain attention

Difficulty should increase progressively.

---

# 10. Existing course migration

We need an intentional migration strategy.

We do not have active paying users at the moment, but two users have meaningful historical progress.

I am open to deleting/regenerating existing course content rather than maintaining the old course architecture indefinitely.

However, users should not unnecessarily lose durable learning/account metrics such as:

- completed lessons
- score
- energy
- BP
- activity history
- lessons per day
- other aggregate progress/statistics

Design an elegant solution for migrating existing content and progress.

Also improve the architecture so that future curriculum restructuring does not require indefinitely preserving every historical course representation.

Explore approaches such as:

- stable conceptual identifiers
- curriculum versioning
- progress mapped independently from generated presentation structure
- explicit migration
- AI-assisted semantic progress mapping

These are possibilities, not requirements.

Prefer the simplest robust architecture.

For the small number of current users, a one-time migration or on-demand mapping on their next visit may be reasonable if that is cleaner than carrying major legacy complexity forever.

---

# 11. Web and Apple app

The main implementation is the current product.

For UI that already exists in the `apple` app:

- update that existing UI when the equivalent shared experience changes
- keep it visually/behaviorally consistent where appropriate

We haven't finished porting all featured to the apple app, though. So, you should **not** implement entirely new product features in the Apple app as part of this task, just update what already exists there to use the new structure.

---

# 12. Architecture expectations

Do not preserve awkward abstractions just because they already exist.

Design the domain model around the product we actually want.

Pay attention to separation between concepts such as:

- reusable curriculum
- course format
- curriculum level
- learner path
- learner preferences
- enrollment/progress
- generated content
- personalization
- content version

These examples are meant to indicate the architectural concerns, not prescribe the schema.

Avoid encoding UI assumptions directly into the content model when they are conceptually different things.

The architecture should make additional learning experiences easier to support later without creating a giant collection of conditionals.

---

# 13. How to approach the work

Use your judgment and work autonomously.

My ideas in this prompt are product hypotheses unless explicitly described as hard requirements.

Do not implement a mediocre idea merely because I mentioned it.

If a better solution addresses the underlying problem, use the better solution.

You should infer routine details from the repository and existing product rather than asking me to make every small product or implementation decision.

If uncertainty would materially alter the product direction, investigate the repository, current behavior, data, and available context first. Make the most reasonable reversible choice when possible.

Do not stop after analysis or after the first working implementation.

Continue until the redesigned experience is implemented, exercised, and reviewed end to end.

Use subagents when parallel specialist review would improve quality, particularly for independent UX/design review or other substantial parallel investigations.

---

# 14. Testing and verification

This is a substantial product redesign, so meaningful testing is required.

Add or update tests where they protect important behavior.

Prioritize:

- E2E coverage of critical learner journeys
- course generation behavior
- personalization/path selection
- access/free/paid states
- migration behavior
- important edge cases

Test relevant combinations of:

- unauthenticated
- authenticated free
- paid
- new learner
- returning learner
- existing progress
- different starting levels
- core
- language
- personalized
- question
- mobile/responsive UI
- generation success/failure/loading states

Run checks appropriate to the changes and fix failures caused by this work.

Do not add meaningless tests just to increase test count.

---

# 15. Independent product and UX review

UX review should happen throughout implementation, not only at the end.

After significant UI/UX work, inspect the result and correct problems before continuing.

When the redesigned flow is substantially complete, ask an independent subagent to review the experience from a UI/UX/product-design perspective without simply validating your own decisions.

Use that critique to improve the implementation.

Then perform a final end-to-end review from multiple perspectives, including where relevant:

- learner/product experience
- UI design
- accessibility
- system architecture
- content generation
- performance
- security
- copywriting
- SEO
- maintainability
- generation cost

The goal is not to produce review documents for their own sake. Fix issues you find.

---

# 16. Definition of done

Do not consider this task complete merely because the application builds or the first implementation works.

It is complete when:

1. The architecture supports `core`, `language`, `personalized`, and `question` coherently.
2. Core courses can remain comprehensive while learners can receive appropriately scoped paths.
3. Language courses handle CEFR progression and non-beginner learners clearly.
4. Personalized courses have an appropriate discovery/generation flow and cost model.
5. Question courses provide a good single-chapter micro-learning experience.
6. Learners are no longer universally forced through the same starting point and learning sequence.
7. Lesson structure supports short, focused, approachable learning.
8. Quiz/practice behavior is redesigned intentionally rather than inherited blindly.
9. The first-course/first-lesson journey is simple and conversion-focused.
10. The experience works cleanly for unauthenticated, free, and paid users.
11. Course lists contain one entry per course rather than one per level.
12. Existing user progress has a sensible migration strategy that does not unnecessarily destroy durable stats.
13. The architecture reduces the chance that future curriculum changes require maintaining obsolete course structures forever.
14. Relevant existing Apple UI has been updated.
15. Important flows have meaningful test coverage and required checks pass.
16. The resulting UI is clean rather than cluttered.
17. An independent UI/UX review has been performed and meaningful findings have been addressed.
18. You have revisited every problem in this prompt and verified that the implemented design has an intentional answer for it.

Before finishing, inspect the actual product experience rather than evaluating the implementation only from code.

The final question is not:

> "Did we implement the requested features?"

It is:

> "Does this now feel like a learning product capable of making almost anything approachable, useful, and compelling enough that people want to keep learning?"

If the answer is not yet convincing, continue improving it.

Do not commit the changes.

## Notes

A few considerations:

- You shouldn’t have to reset the existing database “manually”. The setup we have here locally should be the same we have in production after we deploy, so it should likely be a migration or on-demand update when users visit the course page page. Not sure what’s the best approach but we also shouldn't re-generate all courses at once.
- Also make sure copy is clear and intentional. For example, Don't add something like “Make it yours”. This is super confusing. Something like “Personalize” would probably just sound much clearer but I don’t think we need those two options at all. We could just keep the Start option, then on the screen, we guide users through onboarding where we give them options and one of those could be personalize the course or see the full course
- Btw, we should never overwhelm users with multiple options/choices on the same prefer. Prefer multiple steps flows for this. I think shadcn now even has components for this. Maybe have a look there. They also have a new questionnaire component that might be useful when asking users questions. I think those new components were actually created thinking about AI systems like ours. Have a look at their new components to see if they’re useful here
- Also do an extra comprehensive code and UI/UX review. Use the zoonk code review skill but also review things like copy for clarity and especially review if all problems and requirements we had in our PROBLEMS document are properly solved
- On the code review focus especially on edge cases, possible bugs, performance, architecture (is this solid long-term, will this make it easier to make new course structure changes in the future, etc), security, and simplicity (is this simplest and cleanest approach to achieve this? Are we being creative and clever to how we approach these problems? Is this how a principal engineer would solve these problems?)
- Double check UI/UX. Remember the main UX rule: “Don’t make me think.” UX should be clear and clean. Not offer users too many confusing options. For example, just listing all lesson formats makes them think too much. They know what that means. They haven’t used the product yet. Instead, a better approach is to guide them step by step. Like: “Let’s now choose the lesson formats”. Then, either show nice cards with icons and explanations for each format or show formats one by one explaining what they’re with examples of how they look like, so users can better choose. Also mentioning they can change this anytime and also give them to skip all this and choose all default formats. Think about the principle I’m describing here and add this to the existing zoonk design skill because this is an important principle you always miss. Use this principle to everything you’re reviewing here.
- Understanding how much time they want to spend per day is useful to understand how committed they are, so we can improve what we show them. We shouldn't block them to spend more time than that. On the contrary, it's great if they spend more time than they initially said. This is just to understand how much time they want to commit. It's more an internal metrics for us than for them. We should NOT notify them if they spend more time than they initially said.
