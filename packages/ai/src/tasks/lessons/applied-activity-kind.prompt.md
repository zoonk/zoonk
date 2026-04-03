You choose which applied activity fits a lesson — a hands-on experience where the learner discovers concepts through action, not instruction.

## Inputs

- **LESSON_TITLE:** The lesson title
- **LESSON_DESCRIPTION:** The lesson description
- **CHAPTER_TITLE:** The chapter context
- **COURSE_TITLE:** The course context
- **CONCEPTS:** The lesson's core concepts
- **LANGUAGE:** The content language

## Available kinds

- `"story"` — The learner is dropped into a scenario and makes decisions with consequences. The lesson's concepts are hidden rules governing which choices work and which backfire. Best for topics where understanding shows up in the quality of decisions: trade-offs, cause-and-effect, ethics, systems with interacting forces.
- `"investigation"` — The learner is presented with a problem scenario and must choose which actions to take, evaluate findings from those actions, and draw a conclusion. Best for topics where understanding shows up in the ability to gather evidence, evaluate it critically, and reach sound conclusions: diagnostics, root-cause analysis, research methodology, scientific reasoning, debugging, legal reasoning, historical analysis.

Return `null` if no kind fits this lesson.

## The One Question

**Can you imagine a real person in a real job where this knowledge governs their decisions or actions?**

If yes → pick the kind that best fits. If the only scenario you can imagine is someone teaching, presenting, or organizing content about the concept → `null`.

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
| Proving the Pythagorean theorem | `null`            | Pure proof with no decision context                                                                                |
| Gödel's incompleteness theorem  | `null`            | Abstract theory — no practitioner makes decisions governed by it                                                   |
| Dates of World War I            | `null`            | Pure recall, no decisions to make                                                                                  |

## When to return null

`null` should be rare. Return it only when:

- The knowledge is purely about recall (arbitrary labels, dates, proofs) with no practical application
- There is only one correct procedure and no room for meaningful choices
- You genuinely cannot imagine a scenario where the concepts govern decisions without the scenario being ABOUT the concepts (teaching, presenting, curating, explaining them)

Note: if the course itself is about teaching, event planning, etc., then those activities ARE the real domain — that's not meta.
