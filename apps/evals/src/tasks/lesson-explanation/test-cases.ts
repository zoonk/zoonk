const SHARED_EXPECTATIONS = `
CORE QUALITY DIMENSIONS:

1. ACCURACY: Check every factual claim, mechanism, rule, relationship, calculation, example, and caveat. The explanation must not teach a learner something false or materially misleading.
   - Treat an incorrect core mechanism, rule, cause-effect chain, calculation, or conclusion as a major error. The majorErrors score must be 6.5 or lower even if the rest of the lesson is polished
   - Penalize misleading simplifications that would leave the learner with the wrong mental model
   - Distinguish a harmless wording imprecision from a factual mistake, but never excuse wrong information because the lesson is otherwise clear or engaging

2. CLARITY: Judge how easy the finished lesson is for a broad beginner audience to understand. It should feel like a knowledgeable friend or an excellent broad-audience YouTuber explaining the topic, not a textbook, legal memo, academic paper, exam outline, or reference manual.
   - Prefer plain, familiar words, active sentences, concrete verbs, practical examples, and direct explanations
   - Require the lesson to build from familiar reasoning toward precise language. Necessary technical terms, citations, formulas, or code should come after the learner has enough intuitive context to understand what they describe. Their presence does not prove clarity or completeness
   - Penalize formal or academic wording when a simpler phrase would preserve the meaning, dense noun-heavy sentences, unexplained jargon, citations that interrupt the explanation, stacked definitions, and titles that sound like reference headings instead of helping the idea click
   - Penalize examples that are vague, decorative, or harder to understand than the concept itself
   - Treat a repeated dry, formal, or textbook-like voice across multiple steps as at least a minor error. If the writing makes the lesson materially difficult for a broad beginner audience, treat it as a major error
   - An accurate and complete lesson can still score poorly on clarity. Do not reward difficulty, formality, or boredom as signs of expertise

3. INTUITIVE TEACHING: Judge whether the lesson reconstructs the idea in the order a beginner needs instead of presenting the field's usual expert organization with simpler vocabulary.

PER-CENTRAL-IDEA AUDIT (MANDATORY):
- Turn every required idea and relationship in LESSON_TITLE and LESSON_DESCRIPTION into a separate coverage item for auditing. Do not require a separate card for every item. Do not let one broad intuitive opening stand in for distinct required ideas later. For each coverage item, find the first place where the output actually teaches it; a mention in the title or overview does not count as teaching
- Identify every central teaching move: each content-bearing idea in LESSON_TITLE, plus every mechanism, structure, practice, relationship, pattern, distinction, procedure, or interpretation explicitly required by LESSON_DESCRIPTION. Do not exempt a familiar-sounding label when the description asks the learner to examine, explain, compare, recognize, measure, interpret, or use it. Treat evidence types, background, methods, examples, and caveats as supporting items unless they are themselves the lesson's subject. Do not let the output choose one central item as its theme and reduce another to a mention or list
- Inspect the first explanation step. It should establish a concrete question, observation, contrast, choice, tension, pattern, or problem that embodies the central promise of LESSON_TITLE. Penalize an opening that foregrounds supporting evidence, background, scope, method, or a real-world application before the learner understands the main thing the title promises to explain
- Find the first step that actually teaches each central move. The intuitive reason may lead directly into the technical name, rule, or formula in the same step. Do not require a separate bridge card or a complete intuition section before all formal details; require learner-first order at the point where each idea becomes relevant
- Require each new central move after the first to connect to what the learner already understands, surface the next natural question, or direct attention to a consequential contrast. A stack of self-contained mini-definitions fails even when each definition is plain
- Identify the explanatory job each central move actually requires. Do not infer one job from the course subject or demand cause and effect from every idea:
  - mechanism: parts or forces -> interaction -> result -> useful prediction
  - structure or relationship: parts, quantities, or positions -> arrangement or equivalence -> what it means
  - decision or tradeoff: goal, pressure, or constraint -> plausible options -> choice -> consequence or cost
  - distinction or category: contrasting cases -> separating feature -> recognition of a new case
  - pattern or convention: examples -> shared pattern -> application, changed meaning, or meaningful exception
  - procedure or skill: goal or likely mistake -> cue or action -> feedback showing whether it worked
  - argument, evidence, or interpretation: question or claim -> relevant clues -> inference -> limits or alternatives
- Audit each bridge using its actual job. A lesson may combine several jobs. Penalize a causal story, prediction, human motive, or procedural rationale imposed on an idea that is better explained through structure, pattern, contrast, evidence, or another mode
- Inspect the order strictly. Before an idea relies on a definition, formula, notation, procedure, rule, or specialist term, verify that the learner receives all three: something clear that needs explaining, a simple accurate account of the relevant reasoning or relationship, and a mental model they can use in the way that idea requires. A later intuitive explanation does not repair an expert-first sequence
- Apply the usable-model test without the formal vocabulary: could a beginner use the everyday explanation to predict, compare, classify, reconstruct, interpret, or perform something new? Choose the test that matches the idea. If the learner can only repeat the technical description, the model fails
- Apply the change test only when a central mechanism or varying relationship is involved: can the learner say what changes when an important condition changes and why? Do not require a direction-of-change prediction for an identity, definition, convention, static structure, or interpretation unless the assigned scope actually asks for one
- Apply the choice test only when a deliberate action, practice, or institutional decision is central: can the learner say what people wanted, feared, needed, or owed; why the action served that pressure better than a plausible alternative; and what consequence followed? Do not require motive-action-consequence framing merely because the subject involves people
- When one representative process is needed, require an accurate qualified path from beginning to end before accepting a list of alternatives. When multiple interpretations, patterns, or categories are themselves the lesson's point, require a useful comparison instead of one falsely definitive path
- Do not accept a field-level assertion as the underlying explanation. A causal claim such as one thing controlling, shaping, or reinforcing another needs the real interactions; a structural claim needs the relationship between parts; a convention needs a usable pattern; and an interpretation needs evidence plus limits
- Require a multi-link chain when a mechanism is central: one part acts or changes, that changes another part or condition, and the result follows. Do not impose that chain on non-causal ideas
- Verify that later formal detail connects back to that intuitive understanding. A technical term followed by a plain-language paraphrase still fails when the learner has no model they can reason with
- When any central idea fails this audit, name the idea and the missing layer in the conclusion. Do not return None merely because the lesson is accurate, concise, well organized, or includes an example

FAILURE-MODE AUDIT (MANDATORY):
- PROCEDURE BEFORE ITS PREREQUISITE: Find the first major calculation, measurement, classification, or procedural instruction. Before it, require the ordinary-language model that makes the procedure meaningful: the relevant behavior, relationship, boundary, or goal and why the method can reveal or change it. Then inspect each major instruction for the problem it solves, the cue that guides it, or what would become wrong, unreliable, confusing, or impossible without it. Penalize setup, calibration, or an orderly procedure used as a substitute for the prerequisite understanding
- MECHANISM WITHOUT A PREDICTION: When a physical, biological, technical, social, or other mechanism is central, require an ordinary-language account of which parts interact, how that interaction produces the result, and what should change when a relevant condition changes. Penalize a lesson that merely names the phenomenon or says that one thing affects another. Do not apply this test to non-causal ideas
- SYMBOLS WITHOUT MEANING: Before a central equation, require a symbol-free explanation of the relationship or structure it expresses and the ordinary meaning of its concept-bearing quantities. When the equation describes variation, require the useful direction of change and its reason. When it expresses an identity, definition, equivalence, or proof, require an explanation of why both sides represent the same thing instead of a fabricated causal prediction
- GEOMETRY WITHOUT SPATIAL MEANING: Before a central geometric formula, require ordinary language explaining what the lengths, areas, angles, or positions represent and how the spatial relationship makes the formula sensible. Require a direction-of-change prediction only when variation is part of the assigned idea
- UNCERTAINTY WITHOUT A RANGE MODEL: When uncertainty is required, demand a symbol-free explanation that a range of plausible input readings produces a range of possible results and that less precise inputs make the result less precise. Penalize uncertainty notation or propagation formulas introduced before this relationship is usable
- DELIBERATE ACTION WITHOUT DECISION LOGIC: When a central claim explains why people deliberately chose an action, practice, or policy, require an understandable path from goal, pressure, or constraint through alternatives and choice to consequence. Do not apply this merely because people appear in the lesson
- PATTERN OR CATEGORY WITHOUT CONTRAST: When a rule, convention, pattern, category, or distinction is central, require concrete positive and contrasting cases that reveal what matters. Penalize a list of labels or exceptions that leaves the learner unable to recognize a new case
- STRUCTURE WITHOUT RELATIONSHIPS: When an arrangement, identity, composition, sequence, or other structure is central, require the lesson to show how its parts fit together and why that relationship matters. Penalize a named structure or formula whose parts are defined separately but never connected
- EVIDENCE WITHOUT A QUESTION: When a lesson shifts into evidence, sources, checks, or assessment, require the preceding explanation to establish which claim or uncertainty now needs support. Each source or check should answer part of that question and state its limit. When several evidence types address the same claim, prefer a connected comparison over one independent card per source. Penalize a detached list of evidence types or evaluation rules even when each point is accurate
- INTERPRETATION WITHOUT AN INFERENCE: When interpretation is central, require the lesson to connect concrete clues to a defensible reading and show its limits or reasonable alternatives. Penalize a conclusion presented as obvious, or a list of possible readings with no evidence connecting any of them to the work
- TERMINOLOGY WITHOUT A USABLE MODEL: Penalize specialist terms, internal mechanisms, formulas, or compressed expert shorthand introduced before the learner understands what they mean in the relevant explanatory mode and can reason with them. Naming each component separately is not enough when their relationship still depends on unfamiliar technical concepts
- RELEVANCE WITHOUT EXPLANATION: A real-world reference proves only that the topic appears somewhere. Penalize it as decorative when it does not help explain the relevant mechanism, structure, pattern, distinction, procedure, or inference
- ANALOGY WITHOUT TRANSFER: Analogies are optional. When used, they must preserve the important relationship and connect explicitly to the real idea so the learner can transfer the insight
- UNEARNED FORMALISM: Penalize a formula unless LESSON_TITLE or LESSON_DESCRIPTION requires the learner to calculate with it, derive it, interpret it, or the formula is the simplest accurate expression of a required relationship. Also penalize propagation rules, internal details, advanced variants, or expert caveats that are relevant to the wider topic but unnecessary for the learner to complete this lesson. Formal density is not evidence of completeness

PREREQUISITE-ORDER AUDIT (MANDATORY):
- Quote the first major instruction, calculation, measurement, or formal procedure in the result. Point to the exact earlier words that give the learner its prerequisite ordinary-language model. If those words do not exist, report a major error and score majorErrors at 7.5 or lower. A later mechanism, analogy, or intuitive explanation does not repair the order

WORKING-CARRIER AUDIT (MANDATORY):
- Name the concrete situation, puzzle, object, representation, comparison, observed process, or recurring question that carries the lesson. List which central teaching moves it actively helps reveal or resolve, and identify the last central step where it still does teaching work
- If no carrier or recurring question is identifiable, or it supports only the opening before the lesson becomes a thematic outline, the audit fails. Report this failure in minorErrors or majorErrors according to the severity rules; do not leave it only in potentialImprovements
- When the subject varies, require one accurate representative path to become understandable before the lesson widens to possible motives, outcomes, regions, interpretations, or exceptions. A carrier fails when its concrete actors, objects, readings, clues, or choices disappear into generic “could” lists before one path connects the central ideas
- Do not require the carrier in every step. Direct definitions, caveats, parallel evidence, and formal precision may temporarily leave it when the transition makes their purpose clear. Do not accept a repeated name or decorative reminder as continuity unless it advances the learner's understanding

NARRATIVE-VOICE AUDIT (MANDATORY):
- Read the step texts aloud without their titles. Judge whether they sound like one person guiding a learner through one continuous question, contrast, situation, problem, pattern, or line of reasoning, or like independent textbook points that happen to share a topic
- Identify the lesson's throughline in one sentence. It does not need to be a story, causal chain, single example, second-person address, or series of rhetorical questions. If no throughline is visible from the step texts, the narrative fails
- Identify the lesson's working carrier: the concrete situation, puzzle, object, representation, comparison, observed process, or recurring question through which several central ideas become necessary. Trace it across the central steps. Penalize an opening example that disappears while the rest becomes a sequence of topic summaries. The carrier need not appear in every step, and a stable recurring question or comparison is valid when one concrete example would distort the subject
- Require the carrier to replace exposition rather than add to it. Do not reward a vivid opening followed by a second conventional lesson, and do not require irrelevant details merely to keep a story alive
- Apply the adjacency test to every pair of steps: given what the learner just understood, why do they naturally need or want the next step? Accept a new term, formula, caveat, example, case, clue, or procedure when the previous understanding creates a need for it or the lesson makes clear which shared question the parallel material answers. Penalize transitions that amount only to “another relevant point is…”
- Apply the rearrangement test: if several steps could trade places without changing the reasoning or comparison, the lesson is organized as an outline rather than continuous guided reasoning. Parallel examples, cases, or evidence may legitimately exchange order when their shared role and eventual synthesis are clear
- Check that procedures have momentum too. Each major instruction should arrive as the solution to a visible problem, with the likely error or limitation clear before the learner is told what to do
- Judge spoken naturalness through sentence construction, not informality markers. Prefer concrete subjects, active verbs, and phrasing a knowledgeable person could naturally say aloud. Inspect sentences whose grammatical subject is an abstract summary such as an evaluation, comparison, interpretation, adaptation, or approach; penalize repeated report-like claims when the sentence could instead name what a person notices, what an object does, or which concrete cases differ
- Do not require or reward exact phrases, casual filler, second-person wording, rhetorical questions, a story, or an analogy. “Imagine,” “notice,” “now,” and “think of it this way” do not count as guidance when attached to an otherwise independent textbook point
- Look for genuine moments of recognition where a difficult idea becomes simple enough to reason with and where the learner makes a useful connection they may not have noticed before

COMPRESSION + NOVELTY AUDIT (MANDATORY):
- Assign every explanation step one unique learner gain that advances the throughline: a new mechanism, relationship, distinction, pattern, prediction, example, consequence, interpretation, skill cue, application, or necessary caveat. A new fact does not earn a card when the learner has no reason to need it at that point. If a step only renames, paraphrases, or fragments something already taught, it is redundant
- Do not give the working carrier separate setup or reminder cards that add no learner gain. It should make the required explanation shorter and more connected, not consume extra space beside it
- Penalize a catalogue that assigns one card to every analytical dimension when several dimensions could explain the same moment, choice, observation, or claim in the carrier
- Look specifically for a two-pass lesson: an intuitive sequence that already teaches the central ideas, followed by a conventional definition-driven sequence that teaches those same ideas again. Intuitive scaffolding must replace later exposition, not sit in front of a second version of the lesson
- Once a mental model is usable, the formal name may be added briefly in the same step or the next step may add genuinely useful precision. A technical name alone is not a new learner gain. A formula is new only when the assigned scope requires calculation or interpretation and the formula adds that ability
- Prefer one end-to-end worked example over several cards that separately repeat its setup, calculation, unit conversion, interpretation, and uncertainty when those pieces remain clear together
- Use roughly 8-10 explanation steps and 300-400 words as a diagnostic range, not a fixed requirement. Do not penalize a lesson solely for exceeding it. When a lesson is longer, verify that every extra step is required by the assigned scope and contributes something genuinely new
- If one or two steps can be merged or removed without loss, report the issue under potentialImprovements or minorErrors according to its effect. If three or more steps, roughly a quarter of the lesson, or a repeated intuitive-then-conventional sequence is removable, report a minor error and give minorErrors a score of 8 or lower. Treat substantially excessive repetition that obscures the main lesson as a major error

SEVERITY FOR INTUITIVE TEACHING:
- If a procedural lesson begins calculation or instructions before the ordinary-language model that makes the procedure meaningful, or if its major steps lack a problem, rationale, or useful feedback, report a major error and give majorErrors a score of 7.5 or lower
- If a central idea is taught through the wrong explanatory job—for example, symbols before structural meaning, a causal label without a mechanism, categories without contrast, a deliberate choice without alternatives, or an interpretation without evidence—report a major error and give majorErrors a score of 7.5 or lower when the learner lacks a usable model of the main teaching move
- If the opening steps leave the central teaching move unexplained while prioritizing supporting evidence, procedure, taxonomy, exceptions, or background, report a major error and give majorErrors a score of 7.5 or lower
- If most central technical mechanisms are taught through terminology or internal details without usable everyday models, report a major error and give majorErrors a score of 7.5 or lower
- More generally, if the lesson's main teaching move lacks the underlying reason or a usable mental model, report a major error and give majorErrors a score of 7.5 or lower
- If one required supporting idea fails the per-central-idea audit but the main teaching move remains understandable, report a minor error and give minorErrors a score of 8 or lower
- If the mental models are usable but the voice repeatedly falls back to impersonal textbook entries or omits learner-directed guidance at major transitions, report a minor error and give minorErrors a score of 8 or lower
- If two or more important transitions fail the adjacency test but the main throughline remains understandable, report a minor error and give minorErrors a score of 8 or lower
- If a lesson with several central dimensions has no identifiable working carrier or recurring question, or introduces one and abandons it for a mostly rearrangeable topic outline, report at least a minor error and give minorErrors a score of 8 or lower. Do not report this only as a potential improvement. If the missing or abandoned carrier leaves the main teaching move as organized exposition without a usable throughline, report a major error and give majorErrors a score of 7.5 or lower
- If the lesson is mainly a rearrangeable sequence of independent analytical points, or its main teaching move is a procedure whose major steps are not motivated by the problems they solve, report a major error and give majorErrors a score of 7.5 or lower
- A lesson cannot receive three 10s unless every central idea passes the audit and the narrative voice actively guides the learner through the difficult parts

MANDATORY CLARITY AUDIT:
- Inspect every title and sentence before returning None for minorErrors or potentialImprovements. Ask whether a curious beginner could understand it on the first read and whether a knowledgeable friend would naturally say it that way aloud
- Inspect the conceptual sequence as well as individual sentences. Ask whether the lesson gives the learner a usable reason to believe and reason with each central idea, or merely walks through the expert's categories in simpler words
- Look specifically for steps that lead with a definition, citation, abbreviation, abstract label, or specialist expression before building intuitive understanding; abstract titles that make the learner decode the point; and sentences that compress several ideas into formal expert shorthand
- A phrase does not pass merely because a careful reader could eventually understand it. If a simpler everyday version would preserve the substance and make the idea faster to grasp, count that as a real clarity improvement
- If three or more titles or sentences have these problems, report the repeated pattern under minorErrors and give that step a score of 8 or lower. If one or two localized phrases have the problem, report them under potentialImprovements and score that step below 10. Apply the separate intuitive-teaching severity rules when the problem affects the teaching of a central idea
- Necessary domain terms are not clarity problems when the lesson earns them through intuitive context and explains them in familiar language. Penalize the delivery and sequencing, not the existence of precise terminology

4. COMPLETENESS: The learner should finish with a full working understanding of LESSON_TITLE and LESSON_DESCRIPTION. Include the real mechanism, structure, relationship, calculation, rule, procedure, practical recognition, and important caveats or limits required by that specific scope.
   - Penalize friendly but surface-level explanations that skip the substance
   - Penalize formal details, formulas, variables, code shapes, rules, or terms that appear without explaining what they mean or how they connect
   - Require concrete examples, measurements, cases, code-shaped details, or realistic situations when they are needed to understand how the topic works in practice
   - Treat a missing central concept or mechanism as a major error. Treat a smaller omission according to how much it weakens the learner's working understanding

5. FOCUS + PADDING: Completeness means fully teaching this lesson, not covering everything related to the topic. Every step should earn its place by making the selected lesson easier to understand.
   - Leave sibling angles in OTHER_EXPLANATION_LESSON_TITLES for their own lessons
   - Penalize tangents, repeated points, unnecessary background, exhaustive lists, edge cases beyond the lesson's needs, and extra expert detail that lengthens the lesson without improving understanding
   - Extra information can be accurate and still be padding. Do not reward length, density, or the number of facts by itself
   - Penalize an intuitive opening followed by a second conventional explanation of the same concepts. The intuitive explanation should make later naming and formalization shorter
   - Treat limited removable padding as a minor error or potential improvement. Treat repeated tangents or substantial drift away from the selected lesson as a major error

PERFECT-SCORE BAR:
- A result deserves 10 in all three scoring buckets only when it has no concrete problem or meaningful improvement across accuracy, clarity, intuitive teaching, completeness, and focus
- A correct answer that is noticeably more formal, academic, dry, dense, or difficult than necessary must not receive three 10s. Name the specific clarity problem and lower the appropriate score
- Judge the language across the whole lesson. Do not let one accessible example cancel repeated textbook-like writing elsewhere
- Do not award perfect scores to a lesson that gives accurate definitions and examples but never creates an intuitive mental model for its central unfamiliar ideas
- Do not award perfect scores when multiple cards can be merged or removed because they repeat an intuitive explanation through definitions, formulas, examples, or procedure without adding a new learner gain
- Do not award perfect scores to a lesson that is clear sentence by sentence but lacks a spoken throughline or momentum between its important steps
- Do not award perfect scores when an opening situation or puzzle disappears and the central lesson continues as a conventional topic outline

DELIVERY REQUIREMENTS:

1. REQUIRED STRUCTURE: The output must contain exactly two top-level fields:
   - explanation[]: an array of explanation steps, each with title and text
   - anchor: { title, text } (no visual)

2. EXPLANATION FLOW: The lesson should follow one continuous question, contrast, situation, problem, pattern, or line of reasoning. A concrete working carrier or explicit recurring question should remain active across the central transitions instead of appearing only in the opening. Each important step should answer a need created by the previous understanding or contribute to a clearly established comparison or inquiry. Build from familiar reasoning toward formal precision, give enough intuitive context before unfamiliar terms or machinery, and name the practical payoff when the lesson calls for why the topic matters.

3. STEP QUALITY: Each step.text is 1-3 short sentences of prose. Step titles are short, unique, and useful for understanding what the step teaches. Penalize long paragraphs, vague or generic titles, and repetition between steps.

4. STATIC + RICH TEXT DELIVERY: The lesson should stay entirely within explanation steps plus the closing anchor. It may use inline LaTeX, display LaTeX, bold, italic, and inline code with single backticks. Penalize:
   - Quiz-like interruptions, option lists, or explicit "guess before continuing" instructions
   - Steps that stop to ask the learner to choose instead of explaining
   - Rhetorical-question-only steps that replace a real explanation
   - Markdown headings, lists, tables, links, or large code fences inside a step
   - Malformed LaTeX or unsupported formatting that would show raw clutter to the learner
   - NUL (U+0000), other control characters, or invisible separators before or inside rich-text delimiters. Repeated control characters that can break formula rendering are a major delivery error

5. ANCHOR QUALITY: anchor has no visual. It answers why the topic is useful and where it shows up outside the lesson by naming one specific real-world instance — a named product, recognizable product family, technology, service, system, mission, instrument, event, figure, case, place, or concrete physical action — and what the concept does there. Penalize:
   - Abstract "this is why it matters" wrap-ups, metaphors, or vague generalities
   - References that merely name where the topic appears without explaining the useful connection
   - Classroom demonstrations, lab videos, school apparatus, research instruments, or professional workflows that do not name the product, service, system, or public-world outcome they enable
   - Category-list anchors that name a broad type of use instead of one vivid instance
   - Generic placeholders standing in for a specific recognizable thing, action, place, case, result, or experience
   - Anchors whose only payoff is checking, validating, or calibrating the same classroom, laboratory, measurement, or professional method taught in the lesson rather than connecting it to an outside-world result
   - Treating a named brand or recognizable system in the anchor as evidence that an otherwise abstract lesson was practical or narratively connected. Judge the explanation flow separately

ANTI-CHECKLIST GUIDANCE (CRITICAL):
- Do NOT require a fixed number of steps. Complex topics need more; simple topics fewer. Both are fine as long as the lesson is delivered
- Do NOT penalize a lesson solely for exceeding 10 steps or 400 words. Use those numbers to trigger the novelty audit, then penalize only concrete repetition, fragmentation, padding, or unnecessary scope
- Do NOT require a cold open, story arc, analogy, single scene, or specific opening style. Do require enough familiar orientation before the lesson relies on central formal definitions or mechanisms; a short direct explanation can provide that orientation
- Do NOT require one fictional story, branded example, or literal scene to appear in every step. Require a useful working carrier or recurring question across the central transitions, and allow direct supporting explanations when forcing the carrier would reduce accuracy or clarity
- Do NOT require every fact to depend causally on the sentence before it. Judge whether the lesson has a clear overall throughline and whether its important conceptual transitions follow the learner's reasoning rather than a subject outline
- Do NOT require a causal explanation, direction-of-change prediction, human motive, or procedural rationale when the assigned idea is instead structural, conventional, classificatory, interpretive, or otherwise non-causal. Require the explanatory job that makes that particular idea usable
- Do NOT require specific title wording, a particular choice of product, event, case, experience, or visual kind. The anchor must name some specific real thing, but any reasonable choice is fine
- Do NOT penalize anchors that use a widely recognized product family when the learner can clearly recognize the real-world surface and understand the concept's role there
- Do NOT penalize direct explanatory writing when it is clear, plain, concrete, and complete
- Do NOT penalize necessary expert content when it is explained in everyday language and stays within the lesson scope
- Do NOT focus on JSON wrapping or formatting trivia. Evaluate the content and structural fit
- ONLY penalize for concrete failures in accuracy, clarity, intuitive teaching, completeness, focus, structure, flow, writing constraints, supported formatting, or anchor quality
`;

export const TEST_CASES = [
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about what makes repeated code become one reusable function. Penalize if:
   - Declaring a function is confused with calling it
   - The function name, parameters, or body are treated as optional decoration instead of the structure that defines the reusable block

2. BOUNDARY CHECK: The core arc should stay on the reusable block itself. Penalize if the explanation spends its main teaching move on sibling angles like function calls or return values.

${SHARED_EXPECTATIONS}
    `,
    id: "en-javascript-named-block",
    userInput: {
      chapterTitle: "Functions, parameters, and return values",
      courseTitle: "JavaScript",
      language: "en",
      lessonDescription:
        "Turn duplicated code into a reusable function by naming the repeated job, making the changing parts parameters, and returning the useful result. Practice choosing what should stay inside the function and what should be supplied by each call.",
      lessonTitle: "Extracting reusable functions",
      otherLessonTitles: [
        "Function declarations and calls",
        "Parameters and arguments",
        "Return values",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about raids, captives, and what conflict was trying to achieve. Penalize if:
   - Raids are reduced to random violence or simple looting
   - Captives are treated as incidental rather than part of the meaning and aim of warfare

2. BOUNDARY CHECK: The main arc should stay on raids, captives, and conflict aims. Brief context about honor, memory, alliance, or revenge is fine when it explains why raids or captives mattered. Penalize if revenge logic, colonial stereotypes, or war leadership becomes the primary lesson instead of support for raids and captives.

${SHARED_EXPECTATIONS}
    `,
    id: "en-brazilian-history-raid-purpose",
    userInput: {
      chapterTitle: "Indigenous Brazil before 1500",
      courseTitle: "Brazilian History",
      language: "en",
      lessonDescription:
        "Recognize warfare as a political and ritual practice that varied by region. Use fortified sites, oral memory, and early accounts carefully to examine raids, revenge, alliances, captive taking, and defense.",
      lessonTitle: "Warfare, alliances, and captives",
      otherLessonTitles: [
        "Archaeological evidence and dating",
        "Oral traditions and early written sources",
        "Leadership, kinship, and ritual authority",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about due process, contradiction, and defense preventing procedural surprise. Penalize if:
   - The parties are shown as learning decisive information only after the judge acts
   - Contraditório or ampla defesa are reduced to empty formalities instead of a real chance to know and respond

2. BOUNDARY CHECK: The core arc should stay on avoiding surprise in the process. Brief mentions of procedure, request limits, deadlines, evidence, or reasoning are fine when they explain how the parties know, respond, and influence before a decision. Penalize if the explanation becomes a broad survey of civil-procedure principles or spends its main energy on who can start the case or equality between the parties.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-direito-sem-surpresa",
    userInput: {
      chapterTitle: "Direitos fundamentais",
      courseTitle: "Direito",
      language: "pt",
      lessonDescription:
        "Relacione devido processo legal, contraditório e ampla defesa à proibição de decisão surpresa. O aluno identifica quando as partes tiveram conhecimento, chance de resposta e possibilidade real de influenciar a decisão.",
      lessonTitle: "Contraditório, ampla defesa e decisão surpresa",
      otherLessonTitles: [
        "Devido processo legal",
        "Direito de ação e acesso à Justiça",
        "Igualdade processual",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about reading mRNA in codons while preserving the correct reading frame. Penalize if:
   - DNA bases are read directly from an mRNA codon table without first producing the corresponding mRNA sequence
   - The reading frame is treated as optional or as changing one codon without changing the triplet grouping that follows
   - The degeneracy of the genetic code is described as one codon routinely specifying several different amino acids

2. BOUNDARY CHECK: The core arc should stay on codons, the start and stop signals, using the genetic-code table, and why the reading frame matters. Brief context about transcription, tRNA, or translation is fine when it helps the learner follow that decoding move. Penalize if the explanation turns into a broad survey of DNA structure, RNA processing, ribosome stages, or mutation types.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-biologia-codigo-genetico",
    userInput: {
      chapterTitle: "DNA, RNA e expressão gênica",
      courseTitle: "Biologia",
      language: "pt",
      lessonDescription:
        "Leia o mRNA em trincas e use uma tabela do código genético para converter códons em aminoácidos. Reconheça o códon de início, os códons de parada, a degeneração do código e a importância do quadro de leitura.",
      lessonTitle: "Código genético, códons e quadro de leitura",
      otherLessonTitles: [
        "Dogma central e transcrição reversa",
        "Transcrição e RNA polimerase",
        "Processamento do RNA mensageiro",
        "mRNA, tRNA, rRNA e aminoacil-tRNA sintetases",
        "Iniciação da tradução",
        "Elongação da tradução e sítios A, P e E",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about measuring two different intervals in a workflow. Penalize if:
   - Lead time does not run from request to delivery, or cycle time does not run from work start to completion
   - The two metrics are treated as interchangeable or calculated with incompatible time conventions
   - A shorter cycle time is claimed to prove a short lead time without accounting for the time spent waiting before work starts

2. BOUNDARY CHECK: The core arc should stay on defining, calculating, comparing, and using lead time and cycle time. Brief mentions of waiting, timestamps, or a board are useful when they make the two clocks concrete. Penalize if the lesson becomes mainly about throughput, WIP, work item age, forecasting, or general Kanban management.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-kanban-lead-cycle-time",
    userInput: {
      chapterTitle: "Métricas de fluxo",
      courseTitle: "Kanban",
      language: "pt",
      lessonDescription:
        "Calcule o lead time entre solicitação e entrega e o cycle time entre início e conclusão de um item. Compare os dois intervalos para reconhecer o tempo anterior ao início do trabalho sem confundir suas fronteiras.",
      lessonTitle: "Lead time e cycle time",
      otherLessonTitles: [
        "Limites de medição e eventos do fluxo",
        "Throughput e janela de medição",
        "WIP — trabalho em andamento",
        "Work item age — idade do item",
        "Taxa de chegada e taxa de saída",
        "Média, mediana e valores extremos",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about measuring hydrogen spectral lines from positions and angles, then turning those readings into wavelengths. Penalize if:
   - Spectral lines are treated as decorative colors instead of measured wavelengths
   - Diffraction angles, wavelength, or uncertainty are described with a wrong cause-effect chain

2. REAL-WORLD ANCHOR CHECK: The anchor must not end at a lab video, school spectroscope, classroom demo, or "next time you see this in a lab" framing. It should connect the measured-spectrum idea to a product, technology, system, or public-world result a normal learner can recognize, such as phone/display color tuning, LED or laser manufacturing, medical or environmental spectroscopy, or identifying hydrogen in named telescope observations.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-fisica-quantica-linhas-hidrogenio",
    userInput: {
      chapterTitle: "Espectro do hidrogênio e modelo de Bohr",
      courseTitle: "Física Quântica",
      language: "pt",
      lessonDescription:
        "Meça linhas espectrais do hidrogênio a partir de posições, ângulos, ordens de difração e incerteza de leitura. O aluno transforma observações no espectroscópio em comprimentos de onda comparáveis.",
      lessonTitle: "Medição das linhas espectrais do hidrogênio",
      otherLessonTitles: [
        "Série de Balmer",
        "Séries espectrais e limites de ionização",
        "Transições de energia no hidrogênio",
        "Limites do modelo de Bohr",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Spanish.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about false positives in biosignature claims. Penalize if:
   - Oxygen, ozone, or any single signal is treated as proof of life
   - A false positive is described as bad data instead of a non-biological explanation that still fits the observation

2. BOUNDARY CHECK: The explanation should stay centered on ruling out alternative explanations before claiming life. Penalize if it turns into a general lesson on oxygen, ozone, or chemical disequilibrium without returning to the false-alarm decision.

${SHARED_EXPECTATIONS}
    `,
    id: "es-exoplanetas-falsas-alarmas",
    userInput: {
      chapterTitle: "Habitabilidad y astrobiología",
      courseTitle: "Astronomía",
      language: "es",
      lessonDescription:
        "Evalúa biofirmas posibles en atmósferas de exoplanetas y las explicaciones no biológicas que pueden imitar señales de vida. El alumno usa oxígeno, ozono, metano, contexto estelar y química atmosférica para evitar falsas alarmas.",
      lessonTitle: "Biofirmas y falsos positivos",
      otherLessonTitles: [
        "Zona habitable",
        "Espectros de transmisión atmosférica",
        "Oxígeno, ozono y desequilibrio químico",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about the first stability safeguards in transformer training. Penalize if:
   - AdamW, warmup, and gradient clipping are collapsed into one indistinct trick
   - Gradient clipping is treated as replacing the optimizer or learning-rate schedule

2. BOUNDARY CHECK: The main arc should keep AdamW, warmup/decay, and gradient clipping central. Do not penalize brief supporting safeguards such as pre-normalization, initialization, batch size, or mixed precision when they explain transformer stability and do not replace the central trio. Penalize if label smoothing or attention dropout becomes the primary teaching move instead of sibling context.

3. REAL-WORLD ANCHOR CHECK: ChatGPT, ChatGPT-style models, or another recognizable deployed LLM product/system is a valid real-world anchor. Do not penalize it as a generic category when the anchor clearly connects training stability to a product learners recognize.

${SHARED_EXPECTATIONS}
    `,
    id: "en-transformers-first-training-steps",
    userInput: {
      chapterTitle: "Deep learning training practice",
      courseTitle: "Machine Learning",
      language: "en",
      lessonDescription:
        "Use AdamW, learning-rate warmup and decay, and gradient clipping as core safeguards for stable Transformer training. Compare what each tool controls and why none of them replaces the others.",
      lessonTitle: "Transformer optimization and training stability",
      otherLessonTitles: [
        "Initialization and normalization",
        "Learning-rate schedules",
        "Dropout and regularization",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about why the Pythagorean identity follows from an area rearrangement. Penalize if:
   - The identity is applied to triangles that are not right triangles
   - The side lengths are confused with the areas of the squares built on those sides
   - Rearranging the same congruent triangles is treated as changing their total area

2. BOUNDARY CHECK: The main arc should stay on seeing why the two smaller square areas equal the largest square area. Brief algebra is fine when it records the area comparison. Penalize if the lesson becomes mainly about the distance formula, coordinate proofs, trigonometry, Pythagorean triples, or the converse theorem.

${SHARED_EXPECTATIONS}
    `,
    id: "en-geometry-pythagorean-area",
    userInput: {
      chapterTitle: "Right triangles and distance",
      courseTitle: "Geometry",
      language: "en",
      lessonDescription:
        "Use the areas of squares built on the three sides and a rearrangement of congruent right triangles to explain why the two smaller square areas add to the largest. Connect the picture to a² + b² = c² without treating the equation as a rule to memorize.",
      lessonTitle: "Why the Pythagorean theorem works",
      otherLessonTitles: [
        "Using the Pythagorean theorem",
        "The converse of the Pythagorean theorem",
        "Distance on a coordinate plane",
        "Pythagorean triples",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about distinguishing necessary conditions from sufficient conditions. Penalize if:
   - A necessary condition is treated as guaranteeing the result rather than merely being required for it
   - A sufficient condition is treated as the only possible way to reach the result rather than one condition that guarantees it
   - “If A, then B” is freely reversed into “if B, then A” without establishing the converse

2. BOUNDARY CHECK: The main arc should stay on recognizing which condition is required, which is enough, and why the direction of an implication matters. Concrete contrasting cases are useful. Penalize if the lesson becomes mainly about truth tables, formal proof notation, contraposition, logical validity, or a catalog of named fallacies.

${SHARED_EXPECTATIONS}
    `,
    id: "en-logic-necessary-sufficient",
    userInput: {
      chapterTitle: "Conditional reasoning",
      courseTitle: "Logic",
      language: "en",
      lessonDescription:
        "Distinguish necessary conditions from sufficient conditions by asking whether something is required and whether it is enough to guarantee the result. Use contrasting cases to read one-way implications without accidentally reversing them.",
      lessonTitle: "Necessary and sufficient conditions",
      otherLessonTitles: [
        "Converse, inverse, and contrapositive",
        "Biconditional statements",
        "Truth tables",
        "Validity and soundness",
      ],
    },
  },
  {
    expectations: `
TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about using textual evidence to recognize and interpret an unreliable narrator. Penalize if:
   - The narrator is confused with the author
   - Unreliability is treated as proof that every narrated detail is false or that the narrator must be deliberately lying
   - A reader's suspicion is presented as sufficient without contradictions, omissions, reactions, or other evidence from the work

2. BOUNDARY CHECK: The main arc should stay on how readers notice a gap between a narrator's version and what the text supports. Brief examples of bias, self-deception, limited knowledge, or deliberate deceit are useful. Penalize if the lesson becomes mainly a catalog of narrator types, point-of-view terminology, or general literary-analysis advice.

${SHARED_EXPECTATIONS}
    `,
    id: "en-literature-unreliable-narrator",
    userInput: {
      chapterTitle: "Narrators and point of view",
      courseTitle: "Literature",
      language: "en",
      lessonDescription:
        "Use contradictions, gaps, self-justification, other characters' reactions, and later events to recognize when a narrator's account cannot be accepted at face value. Build an interpretation from textual clues while allowing reasonable uncertainty about what really happened.",
      lessonTitle: "Reading an unreliable narrator",
      otherLessonTitles: [
        "First-person and third-person narration",
        "Limited and omniscient points of view",
        "Narrative distance",
        "Writing a close-reading argument",
      ],
    },
  },
  {
    expectations: `
LANGUAGE REQUIREMENT: Titles and text must be in Portuguese.

TOPIC-SPECIFIC GUIDANCE:

1. ACCURACY CHECK: This lesson is about making guitar chord changes efficient enough to preserve the beat. Penalize if:
   - Faster changes are taught as squeezing harder, rushing the beat, or lifting every finger far from the strings
   - Metronome speed is increased before the learner can repeat the transition cleanly and without excess tension
   - Keeping common or guiding fingers close to the strings is described as mandatory when a particular chord pair does not allow it

2. BOUNDARY CHECK: The main arc should stay on isolating one chord pair, reducing unnecessary movement, preparing the next shape, using the beat as feedback, and increasing speed gradually. Penalize if the lesson becomes mainly about chord construction, strumming patterns, posture, reading chord diagrams, or learning a complete song.

${SHARED_EXPECTATIONS}
    `,
    id: "pt-violao-trocas-acordes-ritmo",
    userInput: {
      chapterTitle: "Coordenação entre acordes e ritmo",
      courseTitle: "Violão",
      language: "pt",
      lessonDescription:
        "Pratique um par de acordes por vez para trocar sem interromper o pulso. Reduza movimentos desnecessários, aproveite dedos comuns ou dedos-guia quando existirem, prepare o próximo formato e aumente o metrônomo apenas depois de repetir a troca com controle.",
      lessonTitle: "Trocas de acordes sem perder o ritmo",
      otherLessonTitles: [
        "Como ler diagramas de acordes",
        "Postura e posição das mãos",
        "Batidas básicas com a mão direita",
        "Formação de acordes maiores e menores",
      ],
    },
  },
];
