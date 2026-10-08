import {
  languageLevelTestViewSchema,
  levelTestAnswerInputSchema,
} from "@zoonk/core/language/level-test/contract";
import {
  mistakePatternPracticeInputSchema,
  mistakePatternPracticeResultSchema,
  mistakePatternViewSchema,
} from "@zoonk/core/language/patterns/contract";
import {
  languageProgressViewSchema,
  languageTodayViewSchema,
  languageUnitViewSchema,
  languageUnitsViewSchema,
} from "@zoonk/core/view-models/language/contract";
import {
  languageLevelTestGenerationSchema,
  languageLevelTestResultSchema,
  languageLevelTestSpokenResultSchema,
  languageUnitPathParamsSchema,
  languageUnitQuerySchema,
  levelTestSpokenAnswerRequestSchema,
  mistakePatternPathParamsSchema,
} from "../schemas/language";
import { goalPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  jsonResponse,
  notFoundResponse,
  smallAiHelpRefusalResponses,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const readErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
  "422": unprocessableEntityResponse,
};

const common = { security: AUTHENTICATED_SECURITY, tags: ["Language"] };

const levelTestPath = "/goals/{goalId}/language-level-test";

export const languageGoalPaths = {
  "/goals/{goalId}/alphabet-skips": {
    post: {
      ...common,
      description:
        "The learner already reads the script of a language goal whose script isn't Latin: their sessions stop opening with its alphabet lesson, starting with today's if it hasn't begun. The lesson stays open as practice. Skipping again changes nothing.",
      operationId: "skipAlphabetIntro",
      requestParams: { path: goalPathParamsSchema },
      responses: { "204": { description: "Skipped" }, ...readErrors },
      summary: "Skip the alphabet intro",
    },
  },
  "/goals/{goalId}/language-progress": {
    get: {
      ...common,
      description:
        "A language goal's Progress: each skill's CEFR level with how it moved since the level test, the target level, \"I can\" checks from the units, and the last four weeks in words, minutes spoken and conversations. `NOT_LANGUAGE` for other goals.",
      operationId: "getLanguageProgress",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageProgressViewSchema, "The goal's language progress"),
        ...readErrors,
      },
      summary: "Get a language goal's progress",
    },
  },
  "/goals/{goalId}/language-today": {
    get: {
      ...common,
      description:
        "What Today adds for a language goal: the level across skills with the target (shown instead of preparation), a pattern noticed in recent mistakes, and the mispronounced words due to be said again.",
      operationId: "getLanguageToday",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageTodayViewSchema, "Today's language cards"),
        ...readErrors,
      },
      summary: "Get Today's language cards",
    },
  },
  "/goals/{goalId}/language-units": {
    get: {
      ...common,
      description:
        "A language goal's units in teaching order, each a real situation with its own page: lessons done and whether the learner can already do it.",
      operationId: "getLanguageUnits",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageUnitsViewSchema, "The goal's units"),
        ...readErrors,
      },
      summary: "List a language goal's units",
    },
  },
  [levelTestPath]: {
    get: {
      ...common,
      description:
        "The three-minute level test: reading and listening questions that adapt to the answers, then one sentence out loud. `preparing` while the language pair's questions are written: only the pair's first learner waits, about `expectedSeconds` from `startedAt`; ask again every few seconds. With `startedAt` null nothing is writing them (the run started with the goal failed): POST /goals/{goalId}/language-level-test/generations when the learner starts the test or taps to try again. Read-only: showing the test never writes the questions.",
      operationId: "getLanguageLevelTest",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageLevelTestViewSchema, "The test's next step"),
        ...readErrors,
      },
      summary: "Get the language level test",
    },
  },
  [`${levelTestPath}/generations`]: {
    post: {
      ...common,
      description:
        "Starts writing the language pair's level test questions in a workflow when nothing is writing them yet, such as after the run started with the goal failed. Call it from the learner's own action (starting the test, trying again), never when the test is shown. A run already writing them is joined; `ready` when they're written.",
      operationId: "createLanguageLevelTestGeneration",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageLevelTestGenerationSchema, "The questions are written"),
        "202": jsonResponse(languageLevelTestGenerationSchema, "The questions are being written"),
        ...readErrors,
      },
      summary: "Start writing the level test's questions",
    },
  },
  [`${levelTestPath}/answers`]: {
    post: {
      ...common,
      description:
        "Answers the test's current question. `answerIndex` null means \"I don't know\".",
      operationId: "answerLanguageLevelTest",
      requestBody: {
        content: { "application/json": { schema: levelTestAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageLevelTestViewSchema, "What comes next"),
        "409": conflictResponse,
        ...readErrors,
      },
      summary: "Answer a level test question",
    },
  },
  [`${levelTestPath}/completions`]: {
    post: {
      ...common,
      description:
        "Ends the test whenever the learner wants. The answers so far set a level for each skill, which the plan and every call use.",
      operationId: "finishLanguageLevelTest",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageLevelTestResultSchema, "The levels by skill"),
        "409": conflictResponse,
        ...readErrors,
      },
      summary: "Finish the language level test",
    },
  },
  [`${levelTestPath}/spoken-answers`]: {
    post: {
      ...common,
      description:
        "The test's sentence out loud, checked word by word for whether a listener would understand it (an accent never counts against it) to set the speaking level. The audio is never kept.",
      operationId: "answerLanguageLevelTestOutLoud",
      requestBody: {
        content: { "multipart/form-data": { schema: levelTestSpokenAnswerRequestSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(
          languageLevelTestSpokenResultSchema,
          "What we heard and what comes next",
        ),
        "409": conflictResponse,
        ...smallAiHelpRefusalResponses,
        ...readErrors,
      },
      summary: "Say the level test's sentence",
    },
  },
  "/language-units/{chapterId}": {
    get: {
      ...common,
      description:
        'A language unit: its "I can" checks and lessons, the grammar tips pinned from its lessons, its words, the learner\'s open mistakes on it by skill, and the conversation to practice.',
      operationId: "getLanguageUnit",
      requestParams: { path: languageUnitPathParamsSchema, query: languageUnitQuerySchema },
      responses: { "200": jsonResponse(languageUnitViewSchema, "The unit"), ...readErrors },
      summary: "Get a language unit",
    },
  },
  "/mistake-patterns/{patternId}": {
    get: {
      ...common,
      description:
        "A pattern noticed in the learner's recent language mistakes: the rule, the mistakes that show it and a three-minute drill, or the note that they were only typos.",
      operationId: "getMistakePattern",
      requestParams: { path: mistakePatternPathParamsSchema },
      responses: { "200": jsonResponse(mistakePatternViewSchema, "The pattern"), ...readErrors },
      summary: "Get a mistake pattern",
    },
  },
  "/mistake-patterns/{patternId}/dismissals": {
    post: {
      ...common,
      description:
        "Takes a pattern off Today without practicing it, such as the note that recent mistakes were only typos. Dismissing it again changes nothing.",
      operationId: "dismissMistakePattern",
      requestParams: { path: mistakePatternPathParamsSchema },
      responses: { "204": { description: "Dismissed" }, ...readErrors },
      summary: "Dismiss a mistake pattern",
    },
  },
  "/mistake-patterns/{patternId}/practices": {
    post: {
      ...common,
      description:
        "Finishes the pattern's drill with the option chosen for each question: pays Brain Power like any practice and counts toward today.",
      operationId: "practiceMistakePattern",
      requestBody: {
        content: { "application/json": { schema: mistakePatternPracticeInputSchema } },
        required: true,
      },
      requestParams: { path: mistakePatternPathParamsSchema },
      responses: {
        "200": jsonResponse(mistakePatternPracticeResultSchema, "The drill's result"),
        ...readErrors,
      },
      summary: "Practice a mistake pattern",
    },
  },
};
