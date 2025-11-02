You are designing a **comprehensive** course for a given field.

## Inputs

- COURSE_TITLE: <subject name>
- APP_LANGUAGE: <output language for titles and descriptions>

## Goal

Produce a complete set of **chapters** that teaches everything essential to perform real work in the field after finishing the course.

## Requirements

- Cover all **knowledge and practical skills** required for getting a job in the field.
- Include **as many chapters as needed**. Do not limit the number of chapters arbitrarily.
- Order from **foundational concepts** to **job-ready skills**.
- Be **vendor neutral** unless the field has widely accepted standards (then name them).
- Write **clear, concise** text in the specified `APP_LANGUAGE`.
- Avoid fluff. Focus on what helps the learner **perform on day one**.
- No assessments, projects, or capstones.

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

## Output Format (strict)

Each chapter must include **exactly two fields**:

- **Title** — short, specific, and professional (see "Examples" section).
- **Description** — 1–2 sentences describing what topics the chapter will cover.

## Thought Process

First, silently plan comprehensive coverage for the job. Then output all necessary chapters in the required format.

## Examples

### Title

Good chapter titles include:

- A "Web Development" course could have chapters like these: "How the web works", "HTML", "CSS", "Responsive Design", "JavaScript", [...], "CI/CD", "Cloud & Edge Delivery", "Caching & Revalidation", "Observability & Monitoring", etc.
- An "Astronomy" course could have chapters like these: "Astronomy Foundations", "Math & Physics for Astronomy", "The Celestial Sphere & Timekeeping", "Coordinate Systems & Ephemerides", "Orbital Mechanics", "Telescopes & Optics", [...], "Space Missions & Archives", "Numerical Modeling & N-body Simulation", "Machine Learning for Astronomy", "Proposals, Grants, and Observing Time", "Ethics, Attribution, and Open Science", "Outreach, Education, and Career Paths", etc.
- A "Digital Marketing" course could have chapters like these: "Digital Marketing Foundations", "Consumer Psychology", "Market Research", "Positioning & Brand Strategy", "Goals, KPIs, and North Stars", "Analytics Fundamentals", [...], "AI for Creative & Media Optimization", "Internationalization & Localization", "Accessibility & Inclusive Marketing", "Compliance, Ethics, and Brand Governance", "Portfolio, Case Studies, and Interview Prep", etc.

### Description

Good chapter descriptions include:

- A "HTML" chapter description could be: "Structure and semantics of web content using HTML: Elements, attributes, forms, multimedia, and accessibility."
- A "Telescopes & Optics" chapter description could be: "Types of telescopes and optical systems: Refractors, reflectors, and advanced designs like adaptive optics."
- A "Market Research" chapter description could be: "Methods and tools for gathering and analyzing market data: Surveys, focus groups, and competitive analysis."
