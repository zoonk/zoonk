# AI task contracts for course redesign

Proposed implementation contracts, 2026-09-12. Reviewed against `PROBLEMS.md`, `COURSE-REDESIGN-PLAN.md` and `COURSE-CONTENT-REVIEW.md`. Documentation only until the root consolidation gate clears. No product code has been edited.

All three tasks use the current task envelope `{data, usage, systemPrompt, userPrompt}`. They accept the existing optional `model`, `useFallback` and `reasoning` parameters. Default to `openai/gpt-5.6-luna` with no premium fallback. Core owns authentication, reservations, durable state, retry ownership, resource IDs and validation of model-selected IDs.

## Resolve a learning request

Export `resolveLearningRequest` and its types from `@zoonk/ai/tasks/courses/request`, implemented in `packages/ai/src/tasks/courses/course-request.ts`.

```ts
type LearningRequestSubject = {
  title: string;
  prompt: string;
  format: "core" | "language" | "question";
  targetLanguage: string | null;
  requiresDiscovery: boolean;
};

type LearningRequestResolution = {
  intent: "unsafe" | "exam" | "question" | "learn" | "ambiguous";
  trackTitle: string | null;
  subjects: LearningRequestSubject[];
};

type LearningRequestParams = {
  prompt: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};
```

This task replaces the three independent coarse classifiers for the new request flow, while existing tasks can remain for existing tools/evals until their callers are migrated deliberately. Its prompt retains the current intent safety/exam boundaries and adds decomposition. `subjects` is empty for unsafe/exam/unresolved ambiguity; no guessed subject is generated merely to fill the array. A personal request with a recognizable teaching subject still yields a subject with `requiresDiscovery: true`. For example, `Python for automating my team's accounting` retains its original material constraints in `prompt` and uses a public-safe subject title `Python`; it does not put employer information into a public canonical title. Core must not persist that `prompt` on a public/shared course.

Exactly one consolidated field stays one subject (`physical chemistry`, `machine learning`). Coequal separately learnable topics become distinct subjects (`physics and chemistry`), with a localized concise `trackTitle`. Do not use a fixed maximum subject count. `targetLanguage` is present only for language subjects and must pass the existing language-code validation; a teaching/source language is not the target.

The resolver never chooses private ownership. `requiresDiscovery` requests intake; discovery can still choose a reusable path when the resolved goal fits. It also never creates a Track: Core creates that owner-specific resource only after authenticated confirmation/start.

## Ask the next useful discovery question

Export `generateCourseDiscovery` and its types from `@zoonk/ai/tasks/courses/discovery`, implemented in `packages/ai/src/tasks/courses/course-discovery.ts`.

```ts
type CourseDiscoveryQuestion = {
  id: string;
  question: string;
  description: string;
  options: { id: string; label: string; description: string }[];
  optional: boolean;
};

type CourseDiscoveryAnswer = { questionId: string; question: string; answer: string };

type CourseDiscoveryBrief = {
  title: string;
  description: string;
  learningGoal: string;
  startingKnowledge: string;
  requirements: string[];
};

type CourseDiscoveryResult = {
  status: "ask" | "ready";
  question: CourseDiscoveryQuestion | null;
  brief: CourseDiscoveryBrief | null;
  format: "core" | "language" | "question" | "personalized" | null;
  reusableCoursePrompt: string | null;
  targetLanguage: string | null;
};

type CourseDiscoveryParams = {
  prompt: string;
  language: string;
  answers: CourseDiscoveryAnswer[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};
```

`ask` requires exactly one question and null brief/format/reuse/target. Each question offers two to five concise selectable options; the delivery UI always adds Other with free text. This option count is unrelated to questionnaire length: there is no question-count cap and no artificial percentage based on an unknown total. Question IDs describe stable information needs (`current-experience`, `desired-outcome`) and must not repeat answered IDs. Option IDs are unique within the pending question. Core stores the pending result so refresh/resume does not regenerate a different question; it converts a selected valid option or explicit Other answer into the trusted answer transcript, never accepts forged question text from the client.

`ready` has null question, a complete brief and non-null format. Reusable core/language/question results require a canonical reusable prompt with no learner-specific context; private results require null reusable prompt. Language also requires a valid target language. Core enforces those cross-field invariants before any generation. The brief's requirements preserve material time, format, age, audience, tools, exclusions, interests and outcome constraints that were actually supplied; it does not invent a huge generic profile. No model can set an owner ID, quota, model policy or course visibility.

Ask only when the answer can change the useful result. Do not re-ask information already supplied or collect school, age, equipment and career details without relevance. `optional` permits a skipped/default preference; unclear teaching intent or a material ambiguity is not resolved by silently guessing. After sufficient answers, prefer an actual reusable course/path over private generation when it preserves the request.

## Select a path from actual reusable chapters

Export `generateCoursePath` and its types from `@zoonk/ai/tasks/courses/path`, implemented in `packages/ai/src/tasks/courses/course-path.ts`.

```ts
type CoursePathChapter = {
  id: string;
  title: string;
  description: string;
  level: string | null;
  prerequisiteIds: string[];
};

type CoursePathResult = { chapterIds: string[]; summary: string };

type CoursePathParams = {
  courseTitle: string;
  language: string;
  goal: string;
  startingKnowledge: string;
  selectedLevel: string | null;
  depth: "overview" | "complete" | "focused";
  chapters: CoursePathChapter[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};
```

The AI task verifies nonempty unique output IDs and membership in the supplied catalog. Core owns authoritative current-version membership, owner access, prerequisite closure, completion handling and race checks. Do not cap chapter IDs. The result is a selected path, never a statement that omitted chapters are completed. Core can construct straightforward Overview/complete/CEFR paths deterministically; use this AI task where a practical goal needs actual subject relevance judgment. The prompt prioritizes outcome-relevant modern methods (including effective AI use, verification and judgment where appropriate) while adding the prerequisites the learner actually needs. It must not replace a request for academic fundamentals with tool operation.

## Consolidation review and implementation dependencies

The root plan matches the content proposal. These clarifications prevent material gaps:

1. All private descendants use the same trusted luna/no-premium policy, including tutorial, quiz, practice, lesson-kind classification and image-prompt rewriting. Public image safety repair must never include private learner identifiers unnecessarily.
2. Reusable outlines retain all chapter thumbnail jobs; private thumbnails run when their chapter is generated, with idempotent retry. A 194-chapter reusable outline has about $1.55 of thumbnail cost at the brief's approximate price, so new-course creation needs reservation as well as chapter/lesson creation.
3. Reusable one-image lesson policy selects a useful teaching step using an explicit index; it is not necessarily the closing anchor, whose existing contract has no image. Native diagram/table/code steps provide further visual meaning. Private lesson raster images require actual instructional value.
4. Remove unconditional first-chapter/intro lesson fanout. After outline/setup, save the chosen learner path, then use the authenticated metered chapter/lesson start. No helper may bypass the public entitlement reservation during warmup or retries.
5. Store actual Core/CEFR level metadata and pass it through chapter and lesson prompts. Validate the complete outline before the version swap. No equal-position CEFR classification.
6. Chapter scope and lesson eval expectations must change together; the old tree traversal and first-function fixtures currently reward excessive scope/repetition. No tests for the Evals app itself; meaningful prompt fixtures and AI/Core/workflow tests protect behavior.
7. A language format preference must not leave an empty primary path, imply completed skipped activities, or force an unsuitable modality back on via automatic continuation. Core must define the primary teaching set consistently with progress, read APIs and next lesson.
8. The historical `how-zoonk-lessons-work` blog sequence needs a clear updated description when the implementation lands. Its learning philosophy remains useful; its compulsory sequence does not.

Core should coordinate exact names for its new level, private brief, curriculum install and quota reservation fields/helpers before API workflow edits start. These AI interfaces intentionally have no dependency on Core or Prisma, preserving the existing package direction.
