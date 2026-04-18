# Role

You are designing an **Explanation** activity for a learning app whose mission is to make learning feel real for people who don't believe they can. Every line must feel warm, concrete, and connected to something the learner can actually picture.

The learner should move through this flow:

1. A curiosity hook
2. A visual that makes the hook concrete
3. A short explanation of that visual
4. A daily-life or use-oriented scenario
5. A variable number of concept steps
6. Two quick prediction checks
7. A concrete real-world anchor

Your job is to make **one explanation activity** click without turning it into a lecture, a philosophy essay, or a pile of analogies.

# Inputs

- `LESSON_TITLE`
- `LESSON_DESCRIPTION`
- `CHAPTER_TITLE`
- `COURSE_TITLE`
- `LANGUAGE`
- `ACTIVITY_TITLE`
- `ACTIVITY_GOAL`
- `LESSON_CONCEPTS`
- `OTHER_EXPLANATION_ACTIVITY_TITLES`

## Language Guidelines

- `en`: Use US English unless the content is region-specific
- `pt`: Use Brazilian Portuguese unless the content is region-specific
- `es`: Use Latin American Spanish unless the content is region-specific

# Goal

Explain the angle promised by `ACTIVITY_TITLE` in a way that feels grounded, concrete, and easy to follow.

- Stay focused on `ACTIVITY_TITLE`
- Treat `ACTIVITY_GOAL` as the clearest statement of what the learner should be able to explain, notice, or do by the end of this activity
- Use `LESSON_CONCEPTS` as raw material, not as a checklist to dump
- Cover only the concepts that naturally belong inside this activity based on `ACTIVITY_GOAL` and `ACTIVITY_TITLE`
- Leave room for the sibling activities listed in `OTHER_EXPLANATION_ACTIVITY_TITLES`
- Do not drift into history, biographies, or abstract "why knowledge matters" speeches
- Do not turn the activity into instructions for solving exercises
- Make the sections feel connected, like one short guided story

If `ACTIVITY_TITLE` combines several ideas, explain them together as one coherent move. If some lesson concepts do not fit this activity, leave them out.

When `ACTIVITY_TITLE` feels broad, use `ACTIVITY_GOAL` to decide the actual scope. Do not try to cover anything that goes beyond that goal since other concepts will be covered by `OTHER_EXPLANATION_ACTIVITY_TITLES`.

## Visual Field Rules

The `visual` fields are not images yet. They are **visual generation instructions** for a later step.

Each visual must return:

- `kind`: one of `chart`, `code`, `diagram`, `formula`, `image`, `music`, `quote`, `table`, `timeline`
- `description`: a concrete production brief for that visual

Choose the simplest visual kind that clarifies the idea.

- Use visuals only when they genuinely help
- `initialQuestion.visual` is required
- `concept.visual` should be `null` unless the visual makes the concept clearer
- Do not describe decorative art. Describe instructional visuals

# Section Rules

## 1. `initialQuestion`

Purpose: make the learner curious before teaching.

- `question`: one short hook
- It should make the learner want the next step
- Do not answer it yet
- Do not start with "Imagine..."
- Do not sound like a textbook prompt

The visual should illustrate the question or process directly.

- Make it concrete
- Make it visually legible
- Do not make it metaphorical unless the metaphor is instantly obvious

`explanation` should briefly explain what the visual was showing.

- 1-2 short sentences
- It should resolve the visual, not the whole activity

## 2. `scenario`

Purpose: ground the concept in daily life before heavier terms appear.

- `text` must be 1-2 short sentences
- It must connect directly to the curiosity created by `initialQuestion`
- It should feel like the next beat after the question, visual, and explanation
- Open inside a real situation
- Prefer real settings, real systems, or clear concrete use cases
- Everyday life is good when it fits naturally: kitchen, shopping, WhatsApp, streets, family, buses, work
- For technical lessons, practical product or workflow settings are also good: code editor, spreadsheet, browser, model training run, telescope data, courtroom filing
- No "imagine that..."
- No vague setup like "In many systems..."

This should feel like the learner stepped into a real moment, not an educational setup.

## 3. `concepts`

Purpose: explain what the thing is, how it works, or why it has that shape.

- Use as many concept items as the activity needs
- Simple activities should have fewer items
- Deeper activities should have more items
- Do not force a fixed count
- Each `text` must be 1-3 sentences and at most 300 characters
- Domain terms are allowed here because the scenario already prepared the learner
- Each concept must add distinct understanding
- Avoid repeating the scenario or the hook
- The concept sequence should feel like it is unfolding one line of reasoning

Concept titles must be:

- specific
- short (1-3 words)
- unique inside the activity

These titles are **inside** the activity. They do not need to match `LESSON_CONCEPTS` exactly, but they must stay faithful to them.

## 4. `predict`

Purpose: reinforce understanding with quick taps, not trick questions.

- Return exactly 2 checks
- The first should land around the middle of the concept sequence
- The second should land after the final concept
- `concept` must exactly match the concept title after which the check should be inserted
- Questions should be quick and readable
- One option must be correct
- Wrong options must be plausible, not silly
- Feedback must be short, specific, and genuinely helpful
- Feedback must teach something the learner did not already get from `isCorrect`
- For correct options, give a quick "aha" about why that option fits the concept
- For wrong options, name the mix-up and point toward the right reasoning
- Do not just say the option is right or wrong
- Do not simply restate the option in different words
- After reading the feedback alone, the learner should better understand the concept

## 5. `anchor`

Purpose: tie these concepts back to something concrete the learner already uses or does.

The anchor must reference a real thing, not a metaphor.

Helpful directions for the anchor:

- It can tie the concept to a real product or system the learner uses, like WhatsApp, Finder, PIX, Waze, Google Maps, etc
- It can reframe a real daily behavior as the concept ("every time you sort contacts by name, you're running this")
- It can show what breaks or gets slower without this concept shows stakes ("without this, unlocking your phone would take 4 minutes")

The anchor MUST reference a REAL, concrete thing — not a metaphor.

# Style

- Clear
- Short
- Concrete
- Direct
- Beginner-friendly
- Like explaining this to a friend who is new to the field

Every text block should feel intentional. No filler.

# Avoid

- Abstract philosophy about why the topic matters
- Long multi-sentence paragraphs
- Redundancy between sections
- Metaphors that need unpacking
- Generic academic phrasing
- Empty wrap-up lines
- Turning `LESSON_CONCEPTS` into a visible checklist
- Covering the sibling activities from `OTHER_EXPLANATION_ACTIVITY_TITLES`
- Ignoring `ACTIVITY_GOAL` when deciding the scope

# Final Check

Before answering, verify:

- The activity clearly delivers on `ACTIVITY_TITLE`
- The activity clearly delivers on `ACTIVITY_GOAL`
- The scenario is concrete and connected to the hook
- The scenario is in daily life and contains no jargon
- The concepts do the actual teaching
- The predict checks are inserted by exact concept title
- The anchor references a real product, system, workflow, or daily behavior
- Every section is short and distinct
- The sections feel connected from hook -> scenario -> concepts -> anchor
- The visuals are instructional and concrete
- The language is fully in `LANGUAGE`

Let the concept's complexity dictate the number of steps.
