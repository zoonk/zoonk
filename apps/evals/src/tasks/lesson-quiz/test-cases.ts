import { type LessonQuizParams } from "@zoonk/ai/tasks/lessons/core/quiz";

const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

0. PRODUCTION-SHAPED SOURCE: Test cases provide one compact lesson title/description scope like production quiz generation. The quiz should cover the best learner-sized assessment for that single lesson.

1. UNDERSTANDING OVER MEMORIZATION: Questions must test conceptual understanding, not recall. A learner who understood the concept but never saw this specific source lesson metadata should be able to answer correctly. Penalize questions that:
   - Use phrases like "according to the text," "as described," or "the lesson said"
   - Reference specific wording from the source lesson title or description
   - Ask "what is X?" instead of "what would happen if..." or "which scenario shows..."

2. APPLICATION TO NOVEL SCENARIOS: Questions should present concepts in new contexts the learner has not seen. Penalize questions that:
   - Reuse source lesson examples with only superficial substitutions, such as changing names while keeping the same object, evidence type, or situation
   - Ask about facts that are not reasonably supported by the source lesson scope
   - Test vocabulary definitions rather than concept application

   IMPORTANT - "Novel" means a different conceptual context, not just swapping a superficial detail. For technical subjects, using a different specific instance of the same error type still tests the same concept and is acceptable. For non-technical examples, prefer changing the setting, evidence, objects, actors, or decision being made. What matters is that the learner must APPLY understanding, not recall a specific example.

   DOMAIN TERMINOLOGY: Using standard domain terminology is acceptable and even desirable, even if the source lesson metadata did not use those exact terms. Do NOT penalize for introducing correct field-standard vocabulary. Only penalize when questions test recall of source-specific phrasing.

3. FORMAT APPROPRIATENESS: Evaluate whether the chosen format genuinely tests understanding.

   Learners prefer a varied set of interaction types. A strong quiz uses multiple formats when the content supports them, distributes those formats through the quiz, and still chooses each format because it fits the concept being tested.

   Format diversity matters, but format fit matters more. A strong quiz uses the required formats when the content supports them, without forcing sort-order onto a concept it does not fit.

   Format guidance:
   - Multiple choice: Default for choosing an interpretation, prediction, diagnosis, explanation, or next move in a scenario.
   - Select image: Default when visual inspection, visible comparison, a diagram, or spatial pattern is part of the concept.
   - Match columns: Use once for connecting related items, such as observations to concepts, symptoms to causes, examples to principles, or tools to roles.
   - Sort order: Use at most once when one correct order is essential, such as procedural steps, cause-effect chains, historical events, dependency chains, or stages that cannot be swapped. Omit sort-order when the scope does not contain a genuinely ordered concept.
   - Fill blank: Use once for completing a precise relationship, contrast, formula, or term when the missing words themselves matter. It is often memorization-prone, so the single fill-blank must be especially well fit.

   PENALIZE when:
   - Formats are used for variety rather than fit
   - A different format would clearly test the concept better
   - The quiz uses more or fewer than 1 match-columns question
   - The quiz uses more than 1 sort-order question
   - The quiz uses more or fewer than 1 fill-blank question
   - A fill-blank question tests copied wording, broad conceptual distinctions, or terminology recall that another format could test through application
   - A sort-order question contains optional steps, branching outcomes, alternative endings, unordered checklists, diagnostic criteria, reasoning checklists, or workflows where several orders could be reasonable
   - The sort-order answer would still be defensible if neighboring items were swapped
   - A select-image question requires inspecting a full board, full dashboard, full workflow, many columns, many cards, tiny labels, or several simultaneous visual clues
   - A select-image question uses text when the distinction could be shown visually without labels
   - A select-image question is chosen for content that needs a complex or text-heavy image to be fair
   - A select-image option would be hard to understand on a small phone screen
   - One format dominates even though other formats could test the content well
   - The same format appears twice in a row

   Do NOT penalize when:
   - Multiple-choice or select-image appears more often than the other formats because those are the default formats
   - The quiz omits sort-order because the source scope lacks a necessary, non-ambiguous sequence
   - Select-image options use a few large labels only when the distinction cannot be shown clearly without text

4. FEEDBACK QUALITY: For formats that include feedback fields in the schema, feedback must explain reasoning, not just state correct/incorrect. Good feedback:
   - For correct answers: Explains WHY it's right plus an additional insight
   - For incorrect answers: Explains WHY it's wrong AND why the correct answer is right
   Penalize feedback that only says "Correct!" or "That's wrong."
   Do NOT penalize match-columns questions for lacking feedback because the match-columns schema has no feedback field.

5. FACTUAL ACCURACY: All questions and answers must be correct for the lesson's domain. Penalize:
   - Incorrect facts presented as correct answers
   - Correct facts marked as incorrect
   - Misleading simplifications that create misconceptions

6. QUESTION CLARITY: Questions must be unambiguous with a conversational tone. Penalize:
   - Academic or formal phrasing
   - Ambiguous scenarios where multiple answers could be valid
   - Trick questions designed to confuse rather than test understanding

7. APPROPRIATE DIFFICULTY: Questions should challenge understanding without being unfair. Penalize:
   - Trivially easy questions anyone could guess
   - Questions requiring knowledge beyond the source lesson scope
   - Trick questions that test careful reading rather than comprehension

8. COVERAGE AND QUESTION COUNT: The quiz must contain enough questions to cover the source lesson scope without exhausting the learner. Penalize:
   - Fewer than 5 questions
   - More than 15 questions
   - A quiz that ignores a major concept, mechanism, caveat, or practical distinction from the source lesson scope
   - Complex scopes compressed into only 5 questions when more are needed to cover the taught ideas, edge cases, and linked mechanisms
   - Simple scopes expanded into too many narrow or repetitive questions

   Target ranges:
   - 5-7 questions for a simple lesson scope
   - 8-12 questions for a dense lesson scope
   - 13-15 questions only when the lesson scope is unusually dense

   Do NOT penalize for producing more than 5 questions when the extra questions cover real concepts from the source lesson scope and stay within the learner-friendly range.

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT expect more than one match-columns, sort-order, or fill-blank question.
- Do NOT require an exact number of questions beyond the minimum and coverage needs
- Do NOT check against an imagined "complete" quiz that goes beyond the source lesson scope
- Do NOT penalize for covering some concepts more than others if every major concept is covered and the balance is reasonable
- Do NOT expect questions to follow any particular order or progression
- ONLY penalize for: memorization-based questions, factual errors, poor feedback quality, unclear wording, inappropriate format choices, poor format diversity, too few questions, too many questions, or missing major concepts
- Different valid quiz designs exist - assess the quality of what IS provided

BINARY CHECKS:
- "Memorization vs understanding" is checked by: does the question reference the source lesson metadata directly or present a novel scenario? Direct source references = penalize. Novel scenarios = do not penalize.
- Question count is checked by: at least 5 questions, never more than 15 questions, and no more than the lesson scope warrants.
- Format choice is checked by fit, diversity, and sequencing. Penalize missing match-columns or fill-blank, overusing heavier formats, forced sort-order for ambiguous sequences, and back-to-back use of the same format.
`;

export const TEST_CASES = [
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}

SPECIFIC EXPECTATION: This scope contains classification and judgment criteria for deciding whether transactions should be recorded. Do not require or reward a sort-order question for ordering the criteria, because entity separation, evidence, monetary measurement, and effect identification can be checked in different defensible orders. A sort-order question is only acceptable if it tests a genuinely fixed accounting sequence.
    `,
    id: "pt-accounting-recordable-transactions-production-quiz",
    userInput: {
      chapterTitle: "Transações contábeis e registros",
      courseTitle: "Contabilidade",
      language: "pt",
      lesson: {
        description:
          "Classifique o efeito da transação sobre caixa, bens, direitos, dívidas, patrimônio, receitas ou despesas. O aluno usa esse efeito para decidir se e como o registro contábil deve aparecer.",
        title: "Efeito patrimonial da transação",
      },
    } satisfies LessonQuizParams,
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in Brazilian Portuguese.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biology-field-evidence-production-quiz",
    userInput: {
      chapterTitle: "Observação biológica e evidências de campo",
      courseTitle: "Biologia",
      language: "pt",
      lesson: {
        description:
          "Use desenho biológico simples para registrar forma, posição, proporção, partes importantes, rótulos, vista observada e dúvidas a confirmar. O aluno trata o desenho como evidência observacional, não como ilustração decorativa.",
        title: "Desenho biológico de campo",
      },
    } satisfies LessonQuizParams,
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in American English.

${SHARED_EXPECTATIONS}

SPECIFIC EXPECTATION: This scope contains a genuinely fixed sequence. A strong quiz should include one sort-order question that asks learners to order the request lifecycle or debugging sequence. Penalize a quiz that omits sort-order entirely, because this is exactly the kind of non-ambiguous procedural chain the format is meant to test.
    `,
    id: "en-web-debugging-request-lifecycle-production-quiz",
    userInput: {
      chapterTitle: "Debugging web requests",
      courseTitle: "Web Development",
      language: "en",
      lesson: {
        description:
          "Trace the browser request lifecycle from URL entry through DNS lookup, TCP/TLS connection, HTTP request, server response, download, parsing, and rendering.",
        title: "Browser request lifecycle",
      },
    } satisfies LessonQuizParams,
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in American English.

${SHARED_EXPECTATIONS}
    `,
    id: "en-product-analytics-funnels-production-quiz",
    userInput: {
      chapterTitle: "Product analytics and funnel analysis",
      courseTitle: "Product Management",
      language: "en",
      lesson: {
        description:
          "Interpret conversion rate, dropoff, segmentation, cohorts, retention, acquisition, leading indicators, and lagging indicators without confusing clues for causes.",
        title: "Conversion and dropoff analysis",
      },
    } satisfies LessonQuizParams,
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Questions, options, and feedback must be in Latin American Spanish.

${SHARED_EXPECTATIONS}
    `,
    id: "es-source-analysis-production-quiz",
    userInput: {
      chapterTitle: "Análisis de fuentes históricas",
      courseTitle: "Historia",
      language: "es",
      lesson: {
        description:
          "Compara fuentes independientes, contradicciones, escalas y ausencias para construir afirmaciones históricas proporcionales.",
        title: "Corroboración de fuentes",
      },
    } satisfies LessonQuizParams,
  },
];
