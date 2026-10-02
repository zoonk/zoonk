import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/contract";
import {
  type CreateLessonQuestionInput,
  type LessonQuestionMemoryChange,
  type LessonQuestionResource,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { onTestFinished, vi } from "vitest";
import { type LessonTutorConfig } from "../lesson/lesson-player-types";
import { type LessonQuestionNavigation } from "../questions/lesson-question-navigation";
import { TestLink } from "./render-lesson-player";

/**
 * The tutor's side of the public API (`/v1/.../questions`), faked in the page: the tutor talks to
 * it with `fetch` through its connection, so the stub sits there and answers like the API, with
 * the learner's saved questions in memory. Tests change what it says one request at a time.
 */

const TUTOR_API_URL = "https://api.zoonk.test";
const TUTOR_AUTHORIZATION = "Bearer tutor-test-token";

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;

/** One question, or its answer: any other path the tutor calls is a thread's questions. */
const QUESTION_PATH = /^\/v1\/questions\/(?<questionId>[^/]+)(?<answers>\/answers)?$/u;

/** What the API's answers say unless a test streams its own. */
export const TUTOR_ANSWER =
  "Gravity keeps pulling while the satellite moves forward, bending its path.";

/** The tutor's requests: a thread page, a new question, one question's status, and its answer. */
type TutorRoute = "answer" | "create" | "question" | "thread";

/** Answers one request: with the API's own response (`serve`), or with anything else. */
type TutorResponder = (serve: () => Promise<Response>) => Promise<Response>;

type QuestionFields = Pick<LessonQuestionResource, "question" | "status"> & {
  answer?: string | null;
  /** The lesson screen it was asked on, by position. */
  step?: number;
};

const ANSWER_STREAM_HEADERS = {
  "Cache-Control": "no-cache",
  "Content-Type": "text/event-stream",
  "x-vercel-ai-ui-message-stream": "v1",
};

/**
 * An answer streamed as the API streams it (an AI SDK UI message stream), written as the test
 * goes: `finish` says the answer is saved, and what memory learned can follow before it closes.
 */
export function tutorAnswerStream() {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (event: object | "[DONE]") =>
    void writer.write(
      encoder.encode(`data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`),
    );

  send({ type: "start" });
  send({ id: "answer", type: "text-start" });

  return {
    close: (memory?: LessonQuestionMemoryChange[]) => {
      if (memory) {
        send({ data: memory, type: "data-memory" });
      }

      send("[DONE]");
      void writer.close();
    },
    finish: () => {
      send({ id: "answer", type: "text-end" });
      send({ type: "finish" });
    },
    response: new Response(readable, { headers: ANSWER_STREAM_HEADERS, status: 200 }),
    write: (delta: string) => send({ delta, id: "answer", type: "text-delta" }),
  };
}

/** A whole answer at once, saved, as the API sends one it wrote quickly. */
export function tutorAnswerResponse(answer: string) {
  const stream = tutorAnswerStream();
  stream.write(answer);
  stream.finish();
  stream.close();
  return stream.response;
}

/** Two frames: whatever the tutor made of a response it just read is on screen by then. */
function nextFrames() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Resolves once the tutor has read the response's body. */
function whenRead(response: Response) {
  const read = Promise.withResolvers<null>();
  const readJson = response.json.bind(response);

  response.json = async () => {
    const body: unknown = await readJson();
    read.resolve(null);
    return body;
  };

  return read.promise;
}

function errorResponse(status: number) {
  return Response.json({ error: "The API refused this request" }, { status });
}

/** A page of the thread, latest last, ending before `cursor` (an older page) when there's one. */
function getThreadPage({
  cursor,
  pageSize,
  questions,
}: {
  cursor: string | null;
  pageSize: number | undefined;
  questions: LessonQuestionResource[];
}) {
  const cursorIndex = cursor ? questions.findIndex((question) => question.id === cursor) : -1;
  const pageEnd = cursorIndex >= 0 ? cursorIndex : questions.length;
  const pageStart = pageSize ? Math.max(0, pageEnd - pageSize) : 0;
  const page = questions.slice(pageStart, pageEnd);
  const hasMore = pageStart > 0;

  return { hasMore, nextCursor: hasMore ? (page[0]?.id ?? null) : null, questions: page };
}

function isInScope({ question, url }: { question: LessonQuestionResource; url: URL }) {
  const stepId = url.searchParams.get("stepId");
  const contextKind = url.searchParams.get("contextKind");

  if (stepId && (!("stepId" in question.context) || question.context.stepId !== stepId)) {
    return false;
  }

  return !contextKind || question.context.kind === contextKind;
}

function getContextSummary(context: CreateLessonQuestionInput["context"]) {
  if (context.kind !== "step" && context.kind !== "answer") {
    return { kind: context.kind };
  }

  return { kind: context.kind, stepId: context.stepId, stepNumber: context.stepNumber };
}

type TutorRequest =
  | { request: Request; route: "create" | "thread" }
  | { questionId: string; request: Request; route: "answer" | "question" };

function toTutorRequest(request: Request): TutorRequest {
  const match = QUESTION_PATH.exec(new URL(request.url).pathname);
  const questionId = match?.groups?.questionId;

  if (questionId) {
    return { questionId, request, route: match.groups?.answers ? "answer" : "question" };
  }

  return { request, route: request.method === "POST" ? "create" : "thread" };
}

/**
 * Fakes the tutor's API for one test and returns it: the saved `questions` (oldest first, which
 * tests change as another client would), every question `inputs` sent, and `requests` by route.
 * `next` answers the next request of a route its own way; `hold` and `fail` are the usual ones.
 */
export function stubTutorApi({
  lesson,
  pageSize,
}: {
  lesson: PlayableLibraryLesson;
  /** How many questions a thread page holds; without it, the whole thread comes at once. */
  pageSize?: number;
}) {
  const threadId = crypto.randomUUID();

  const responders: Record<TutorRoute, TutorResponder[]> = {
    answer: [],
    create: [],
    question: [],
    thread: [],
  };

  /** Saved questions sort by when they were made, so each one is made a second after the last. */
  const clock = { time: Date.parse("2026-01-01T00:00:00.000Z") };

  function stamp() {
    clock.time += 1000;
    return new Date(clock.time).toISOString();
  }

  const createdByRequestId = new Map<string, { input: string; questionId: string }>();

  const api = {
    /** The server finishes a question's answer, as when it's generated elsewhere. */
    complete(questionId: string, answer = TUTOR_ANSWER) {
      api.questions = api.questions.map((question) =>
        question.id === questionId
          ? { ...question, answer, status: "completed" as const, updatedAt: stamp() }
          : question,
      );
    },
    /** The next request to `route` gets an error `status` instead. */
    fail(route: TutorRoute, status: number) {
      api.next(route, () => Promise.resolve(errorResponse(status)));
    },
    /**
     * The next request to `route` waits: the server answers as it would when the request arrives,
     * and the response reaches the tutor once the test releases it. Releasing resolves once the
     * tutor has read the response and the screen shows what it made of it.
     */
    hold(route: TutorRoute) {
      const release = Promise.withResolvers<null>();
      const read = Promise.withResolvers<null>();

      api.next(route, async (serve) => {
        const response = await serve();
        await release.promise;
        void whenRead(response).then(read.resolve);
        return response;
      });

      return async () => {
        release.resolve(null);
        await read.promise;
        await nextFrames();
      };
    },
    inputs: [] as CreateLessonQuestionInput[],
    next(route: TutorRoute, respond: TutorResponder) {
      responders[route].push(respond);
    },
    /** A question saved on the lesson's screen at `step`, made after every question before it. */
    question({
      answer = null,
      question,
      status,
      step = 0,
    }: QuestionFields): LessonQuestionResource {
      const createdAt = stamp();
      const context = { kind: "step" as const, stepId: lesson.steps[step]?.id ?? null };

      return {
        answer,
        context: { ...context, stepNumber: step + 1 },
        createdAt,
        id: crypto.randomUUID(),
        question,
        status,
        updatedAt: createdAt,
      };
    },
    questions: [] as LessonQuestionResource[],
    requests: { answer: 0, create: 0, question: 0, thread: 0 } satisfies Record<TutorRoute, number>,
  };

  function serveThread(url: URL) {
    const page = getThreadPage({
      cursor: url.searchParams.get("cursor"),
      pageSize,
      questions: api.questions.filter((question) => isInScope({ question, url })),
    });

    return Response.json(
      api.questions.length === 0 ? null : { id: threadId, lessonId: lesson.id, ...page },
    );
  }

  /** Like the API, a create is idempotent by its request id: a replay gets the same question. */
  async function serveCreate(request: Request) {
    const input = createLessonQuestionInputSchema.parse(await request.json());
    api.inputs = [...api.inputs, input];
    const created = createdByRequestId.get(input.requestId);

    if (created) {
      const question = api.questions.find((candidate) => candidate.id === created.questionId);
      const isSameRequest = created.input === JSON.stringify(input);

      return isSameRequest && question
        ? Response.json(question, { status: 201 })
        : errorResponse(HTTP_STATUS_CONFLICT);
    }

    const createdAt = stamp();

    const question: LessonQuestionResource = {
      answer: null,
      context: getContextSummary(input.context),
      createdAt,
      id: crypto.randomUUID(),
      question: input.question,
      status: "pending",
      updatedAt: createdAt,
    };

    createdByRequestId.set(input.requestId, {
      input: JSON.stringify(input),
      questionId: question.id,
    });

    api.questions = [...api.questions, question];
    return Response.json(question, { status: 201 });
  }

  function serveQuestion(questionId: string) {
    const question = api.questions.find((candidate) => candidate.id === questionId);
    return question ? Response.json(question) : errorResponse(HTTP_STATUS_NOT_FOUND);
  }

  function serveAnswer(questionId: string) {
    api.complete(questionId);
    return tutorAnswerResponse(TUTOR_ANSWER);
  }

  async function respondAsApi(tutorRequest: TutorRequest) {
    switch (tutorRequest.route) {
      case "answer":
        return serveAnswer(tutorRequest.questionId);
      case "create":
        return serveCreate(tutorRequest.request);
      case "question":
        return serveQuestion(tutorRequest.questionId);
      case "thread":
        return serveThread(new URL(tutorRequest.request.url));
      default:
        return tutorRequest satisfies never;
    }
  }

  const realFetch = globalThis.fetch.bind(globalThis);

  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const request = new Request(input, init);

    if (new URL(request.url).origin !== TUTOR_API_URL) {
      return realFetch(input, init);
    }

    // The API knows the learner by the bearer token the tutor's connection adds to each request.
    if (request.headers.get("Authorization") !== TUTOR_AUTHORIZATION) {
      return Promise.resolve(errorResponse(HTTP_STATUS_UNAUTHORIZED));
    }

    const tutorRequest = toTutorRequest(request);
    api.requests[tutorRequest.route] += 1;
    const respond = responders[tutorRequest.route].shift();

    return respond ? respond(() => respondAsApi(tutorRequest)) : respondAsApi(tutorRequest);
  });

  onTestFinished(() => fetchSpy.mockRestore());

  return api;
}

/** The tutor as a host app sets it up for a learner who may ask, reaching the faked API. */
export function buildTutor(navigation: Partial<LessonQuestionNavigation> = {}): LessonTutorConfig {
  return {
    canAsk: true,
    connection: {
      apiUrl: TUTOR_API_URL,
      getHeaders: () => Promise.resolve({ Authorization: TUTOR_AUTHORIZATION }),
    },
    navigation: {
      linkComponent: TestLink,
      loginHref: "/login",
      subscriptionHref: "/subscription",
      ...navigation,
    },
  };
}
