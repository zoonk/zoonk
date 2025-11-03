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
- "build tools" is better than "Webpack"/"Vite".
- "cloud providers" is better than "AWS"/"Azure"/"GCP".
- "relational databases" is better than "MySQL"/"PostgreSQL".
- "containers" is better than "Docker"/"Podman".
- "orchestration tools" is better than "Kubernetes"/"Docker Swarm".

### Exceptions

- Widely known tools like "Git", "Linux", etc. can be named directly.
- If a course is about a specific tool or vendor, then of course name it directly.
- A course about "Agile Methodologies", for example, can name things like "Scrum", "Kanban", etc. directly.
- This doesn't mean you shouldn't teach those topics. For example, you could have chapters like "Cloud Computing", "Relational Databases", "Data Analysis", etc. without naming specific vendors/tools.

## Cross-Functional Coverage (adapt as relevant to the subject)

- Collaboration and communication in real workflows.
- Ethics, safety, and legal/compliance basics.
- Quality, testing/validation, and continuous improvement.
- Common tools, file formats, and day-to-day workflows used in the job.
- Data literacy for the field (basic measurement, metrics, and reporting where applicable).
- Accessibility and inclusion where relevant.
- Internationalization/localization if the field commonly requires it.

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

- A "Web Development" course could have chapters like these: "How the web works", "HTML", "CSS", "Responsive Design", "JavaScript", etc.
- An "Astronomy" course could have chapters like these: "Astronomy Foundations", "Math & Physics for Astronomy", "The Celestial Sphere", "Orbital Mechanics", etc.
- A "Digital Marketing" course could have chapters like these: "Consumer Psychology", "Market Research", "Positioning & Brand Strategy", "Goals, KPIs, and North Stars", "Analytics Fundamentals", etc.

#### Good and Bad Titles

- Just "HTML" is better than "HTML Structure and Semantics" (structure and semantics are implied if this is the only HTML chapter). Similarly, if we only have one CSS chapter, just "CSS" is better than "CSS Styling and Layout".
- "Front-end frameworks" is better than "Front-End UI Frameworks Overview" (too verbose) or "Front-End Frameworks: Core Concepts" (core concepts is unnecessary fluff)
- "Relational Databases" is better than "Relational Databases and SQL" (SQL is implied, no need to mention)
- "Introduction to Java" is better than "Introduction to Java and Setting Up Your Development Environment" (too verbose)
- "Lean Startup" is better than "The Lean Startup Methodology: An Overview" (too verbose)

**TIP:** Go straight to the point. Avoid verbose titles. If necessary, add details in the description instead.

### Description

- NEVER use fluff/fillers/unnecessary words like "learn", "understand", "explore", "introduction to", "basics of", "comprehensive guide to", etc.

Good chapter descriptions include:

- A "HTML" chapter description could be: "Structure and semantics of web content using HTML: Elements, attributes, forms, multimedia, and accessibility."
- A "Telescopes & Optics" chapter description could be: "Types of telescopes and optical systems: Refractors, reflectors, and advanced designs like adaptive optics."
- A "Market Research" chapter description could be: "Methods and tools for gathering and analyzing market data: Surveys, focus groups, and competitive analysis."

#### Good and Bad Descriptions

- "Styling with CSS: Selectors, properties, the box model, Flexbox, CSS Grid, and cascade principles." is better than "Master styling and layout with CSS, including selectors, properties, the box model, Flexbox, CSS Grid, and cascade principles." - "Master" is fluff, and so are words like "learn", "understand", "explore", etc.
- "Properties of matter, states, and phase transitions." is better than "Explore the definition of Chemistry, properties of matter, states, and phase transitions." - "Explore the definition of Chemistry" are filler/unnecessary words.
