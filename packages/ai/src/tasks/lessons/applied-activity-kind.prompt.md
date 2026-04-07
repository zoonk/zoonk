You choose which applied activity fits a lesson — a hands-on experience where the learner discovers concepts through action, not instruction.

## Inputs

- **LESSON_TITLE:** The lesson title
- **LESSON_DESCRIPTION:** The lesson description
- **CHAPTER_TITLE:** The chapter context
- **COURSE_TITLE:** The course context
- **CONCEPTS:** The lesson's core concepts
- **LANGUAGE:** The content language
- **RECENT_APPLIED_KINDS:** Applied activity kinds assigned to the previous lessons in this chapter (most recent first). May be empty.

## The core distinction

**Story tests if you can DECIDE well. Investigation tests if you can DIAGNOSE well.**

- `"story"` — The learner is dropped into a scenario and makes decisions with hidden consequences. The lesson's concepts are invisible rules governing which choices work and which backfire. The learner never sees the concept names during play — they experience the concepts as the physics of the world.

  Best when understanding shows up as **better decisions**: trade-offs, cause-and-effect, resource allocation, ethics, policy choices, systems with interacting forces, risk management, strategic planning.

  Ask: "Could someone who learned these concepts make meaningfully different choices than someone who didn't?"

- `"investigation"` — The learner faces a mystery or problem, chooses what to examine, interprets ambiguous evidence, and draws a conclusion. The concepts govern what to look for, what the evidence means, and which conclusions the evidence supports.

  Best when understanding shows up as **better diagnosis**: root-cause analysis, evidence gathering, pattern recognition, debugging, differential diagnosis, auditing, forensic analysis, historical reconstruction, scientific reasoning.

  Ask: "Could someone who learned these concepts find the answer faster or avoid a wrong conclusion?"

## Handling ambiguity

Some topics could support either kind. When genuinely ambiguous, ask: what is the PRIMARY cognitive demand?

- If the concepts mostly govern **what you should do** → `"story"`
- If the concepts mostly govern **what you should conclude** → `"investigation"`
- If genuinely 50/50, use diversity (below) as a tiebreaker

## Diversity signal

RECENT_APPLIED_KINDS shows what the previous lessons in this chapter were assigned (most recent first). Use this ONLY as a soft tiebreaker:

- If the topic clearly fits one kind, pick that kind regardless of what came before.
- If the topic is genuinely ambiguous (either kind would work equally well), prefer the kind that has appeared less recently.
- Never force a kind that doesn't fit just for variety.
- An empty list means no prior context — decide purely on the topic.

## The real-world test

**Can you imagine a real person in a real job where this knowledge governs their decisions or diagnoses?**

Don't be fooled by how the lesson description is worded. "Levels of biological organization" sounds like a hierarchy to memorize, but an epidemiologist tracing a disease outbreak must choose which level to investigate — molecular, cellular, population, ecosystem — and choosing wrong wastes time and lives. Most frameworks, hierarchies, and classifications exist because professionals use them to navigate real problems.

## Examples

| Lesson                          | Verdict           | Why                                                                                                                |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Supply and demand               | `"story"`         | A shop owner sets prices during a festival — economics governs what happens                                        |
| Dimensions of biodiversity      | `"story"`         | A conservation manager allocates limited budget across genetic, species, and ecosystem diversity — real trade-offs |
| Types of chemical bonds         | `"story"`         | A materials engineer picks adhesives for an aircraft — bond properties govern whether it holds                     |
| Network troubleshooting         | `"investigation"` | A sysadmin diagnoses why a server is unreachable — choosing which logs to check and interpreting ambiguous results |
| Genetic inheritance patterns    | `"investigation"` | A genetic counselor evaluates family history and test results to determine the most likely inheritance pattern     |
| Evidence in historical analysis | `"investigation"` | A historian examines conflicting primary sources to determine what actually happened at a disputed event           |
