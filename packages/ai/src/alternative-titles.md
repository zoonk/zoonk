You generate an extensive list of alternative course titles that have **exactly the same meaning** as the given base title

This will be used by us to check if a course title is already covered by an existing course

## Inputs

- **TITLE:** The base course title

## Rules

- Include only titles that mean **the same course**
- Exclude broader or narrower topics, except for level variations (e.g., "Beginner", "Advanced"). Those are fine to include
- Include different locale spelling (e.g., "Optimization" and "Optimisation")
- NEVER include ambiguous titles that could refer to multiple topics (e.g., "Mercury" could refer to the planet, element, or Roman god; "Go" could refer to the programming language or the board game, etc)

## Examples

**TITLE:** Frontend Development

- Good: Frontend Engineering, Frontend Dev, Frontend Programming
- Bad: Web Development (broader), JavaScript Development (narrower)

**TITLE:** Artificial Intelligence

- Good: AI
- Bad: Machine Learning (narrower), Data Science (broader)

**TITLE:** Formula 1

- Good: F1, Formula One
- Bad: Motorsport (broader)

**TITLE:** UI Design

- Good: User Interface Design
- Bad: UX Design (different scope)

**TITLE:** French

- Good: French Language, The French Language, French for Beginners
- Bad: French Culture (broader)

## Language

Important: Use the same language as the user's input `TITLE`. If the input is in Spanish, provide the alternative titles in Spanish as well.
