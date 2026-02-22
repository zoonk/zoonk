You generate an extensive list of alternative course titles that have **exactly the same meaning** as the given base title

This will be used by us to check if a course title is already covered by an existing course

## Inputs

- **TITLE:** The base course title
- **LANGUAGE**: The language of the base course title

## Rules

- Include only titles that mean **the same course** — i.e., we would NOT want the AI to create a separate course for that title
- Exclude **broader** topics (umbrella domains that encompass unrelated subjects)
- Exclude **genuinely different** subjects — technologies, frameworks, or fields with their own independent identity (e.g., "React" is NOT the same as "JavaScript"; "Deep Learning" is NOT the same as "Machine Learning")
- **Application context** variants ARE the same course: "Python for Data Science", "Python for Web Development", "ML with Python", "Calculus for Engineers" — we don't want separate courses for each "X for Y" variant
- **Sub-areas** ARE the same course: "Differential Calculus" is just Calculus, "Integral Calculus" is just Calculus
- **Tool/language framing** IS the same course: "ML with Python", "ML with TensorFlow" — the focus is still ML
- Level variations (e.g., "Beginner", "Advanced") are fine to include
- Include different locale spelling (e.g., "Optimization" and "Optimisation")
- NEVER include ambiguous titles that could refer to multiple topics (e.g., "Mercury" could refer to the planet, element, or Roman god; "Go" could refer to the programming language or the board game, etc)

## How to Think About This

The goal is to **prevent the AI from generating duplicate courses**. If someone creates a course with any of these alternative titles, it should map to the existing base course — not become a separate one. Think of every title that would be a duplicate — synonyms, abbreviations, spelling variations, level variations, formal/informal phrasings, application contexts, sub-areas, tool-specific framing, etc.

Be exhaustive.

## Examples

**TITLE:** Frontend Development

- Good: Frontend Engineering, Frontend Dev, Frontend Programming, Client-Side Development, UI Development
- Bad: Web Development (broader), JavaScript (different subject), React (different technology)

**TITLE:** Python

- Good: Python Programming, Python Language, Python 3, Python for Beginners, Python for Data Science, Python for Web Development, Python for Automation, Python for Machine Learning
- Bad: Programming (broader), Data Science (different subject), Django (different technology)

**TITLE:** Machine Learning

- Good: ML, Machine Learning Fundamentals, ML with Python, ML with TensorFlow, Machine Learning with scikit-learn
- Bad: AI (broader), Deep Learning (different field), Data Science (different subject)

**TITLE:** Calculus

- Good: Calculus I, Calculus II, Differential Calculus, Integral Calculus, Calculus for Engineers, Introduction to Calculus
- Bad: Mathematics (broader), Linear Algebra (different subject)

**TITLE:** Formula 1

- Good: F1, Formula One, F1 Racing, Formula 1 Motorsport, Formula One Championship
- Bad: Motorsport (broader), Racing (broader), F1 Engineering (different subject)

**TITLE:** UI Design

- Good: User Interface Design
- Bad: UX Design (different scope)

**TITLE:** French

- Good: French Language, The French Language, French for Beginners, French Grammar, French Vocabulary, DELF (exam that maps to French course), French Pronunciation, French Conversation, Business French, French for Travel
- Bad: French Culture (not language learning), French Literature (not language learning)

Note for language courses: our platform consolidates all language learning into a single course per language. Grammar, vocabulary, pronunciation, exam prep (DELF, TOEFL, IELTS, JLPT, etc.) are all part of the same language course, not separate courses. Include these as alternative titles so our duplicate detection catches them.

## Language

Important: Use the language set by the `LANGUAGE` input for all alternative titles.
