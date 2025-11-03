You are designing a **comprehensive** course for a given field and level.

## Inputs

- `COURSE_TITLE`: name of the subject
- `LANGUAGE`: output language for titles and descriptions
- `LEVEL`: target proficiency level (basic, intermediate, advanced)
- `PREVIOUS_CHAPTERS`: list of chapters covered in previous levels (will be empty for basic level)

### Language

- `en`: Use US region unless the content is about a different region.
- `pt`: Use Brazilian Portuguese unless the content is about a different region.

## Goal

Produce a **complete** set of chapters that teaches everything essential for the given level (see level goal section)

## Requirements

- Cover all **knowledge and practical skills** required for being ready for a job in the field.
- Include **as many chapters as needed**. Do not limit the number of chapters arbitrarily.
- Order from **foundational concepts** to **job-ready skills**, following a logical progression building upon previous chapters.
- Write **clear, concise** text in the specified `LANGUAGE` input.
- Avoid fluff/fillers/unnecessary words. Focus on what helps the learner **perform on day one**.
- Should be **up-to-date**, **modern**, and cover the **latest trends** in this field.
- No assessments, projects, or capstones.
- Include chapters that build upon the `PREVIOUS_CHAPTERS` input.
- Do **not** include previous chapters in your output.
- For hobbies, pop culture, or non-professional topics, you don't need to focus on job readiness. Instead, focus on comprehensive coverage of the topic.

## Vendor Neutrality Guidelines

Be **vendor neutral** unless the field has widely accepted standards (then name them). The main idea behind this rule is that, if a tool change, we shouldn't need to change the chapter title or description. For example:

- "package managers" is better than "npm"/"yarn"/"pnpm".
- "relational databases" is better than "MySQL"/"PostgreSQL".

### Exceptions

- Widely known tools like "Git", "Linux", etc. can be named directly.
- If a course is about a specific tool or vendor, then of course name it directly.
- A course about "Agile Methodologies", for example, can name things like "Scrum", "Kanban", etc. directly.
- This doesn't mean you shouldn't teach those topics. For example, you could have chapters like "Cloud Computing", "Relational Databases", "Data Analysis", etc. without naming specific vendors/tools.

## Scope & Granularity Guidelines

- Prefer **practical, job-linked** chapter scopes (e.g., “Forms & Validation” rather than “Advanced Miscellaneous”).
- Where the field spans multiple modalities (e.g., theory + tools + ops), make that explicit with separate chapters.
- Where safety or compliance applies, include a dedicated chapter.
- Where performance, reliability, or scalability matters, include a dedicated chapter.

## Output Format

Each chapter must include **exactly two fields**:

- **Title** — short, specific, and professional (see "Examples" section).
- **Description** — 1–2 sentences describing what topics the chapter will cover. Go straight to the point (see "Examples" section).

## Examples

### Title

Good chapter titles include:

- "How the web works", "HTML", "CSS", "Responsive Design", "JavaScript", etc.
- Just "HTML" is better than "HTML Structure and Semantics" (structure and semantics are implied if this is the only HTML chapter).
- "Lean Startup" is better than "The Lean Startup Methodology: An Overview" (too verbose)

**TIP:** Go straight to the point. Avoid verbose titles. If necessary, add details in the description instead.

### Description

- NEVER use fluff/fillers/unnecessary words like "learn", "understand", "explore", "introduction to", "basics of", "comprehensive guide to", etc.

Good chapter descriptions:

- "Structure and semantics of web content using HTML: Elements, attributes, forms, multimedia, and accessibility."
- "Types of telescopes and optical systems: Refractors, reflectors, and advanced designs like adaptive optics."
- "Properties of matter, states, and phase transitions." is better than "Explore the definition of Chemistry, properties of matter, states, and phase transitions." - "Explore the definition of Chemistry" are filler/unnecessary words.
