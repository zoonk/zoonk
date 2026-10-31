import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/playable-lesson";
import {
  type CreateLessonQuestionInput,
  type LessonQuestionMemoryChange,
  type LessonQuestionResource,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { onTestFinished, vi } from "vitest";
import { getContextSummary, getThreadPage } from "./tutor-api-requests";

const UNANSWERED = { planChange: null, toolOffer: null } as const;

export const TUTOR_API_URL = "https://api.zoonk.test";
export const TUTOR_AUTHORIZATION = "Bearer tutor-test-token";

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_CONFLICT = 409;

const QUESTION_PATH = /^\/v1\/questions\/(?<questionId>[^/]+)(?<answers>\/answers)?$/u;

export const TUTOR_ANSWER =
  "Gravity keeps pulling while the satellite moves forward, bending its path.";

type TutorRoute = "answer" | "create" | "question" | "thread";

type TutorResponder = (serve: () => Promise<Response>) => Promise<Response>;

type QuestionFields = Pick<LessonQuestionResource, "question" | "status"> & {
  answer?: string | null;
  step?: number;
};

const ANSWER_STREAM_HEADERS = {
  "Cache-Control": "no-cache",
  "Content-Type": "text/event-stream",
  "x-vercel-ai-ui-message-stream": "v1",
};

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
    part: (type: `data-${string}`, data: unknown) => send({ data, type }),
    response: new Response(readable, { headers: ANSWER_STREAM_HEADERS, status: 200 }),
    write: (delta: string) => send({ delta, id: "answer", type: "text-delta" }),
  };
}

export function tutorAnswerResponse(answer: string) {
  const stream = tutorAnswerStream();
  stream.write(answer);
  stream.finish();
  stream.close();
  return stream.response;
}

export function nextFrames() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

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

function toPendingQuestion({
  createdAt,
  input,
}: {
  createdAt: string;
  input: CreateLessonQuestionInput;
}): LessonQuestionResource {
  return {
    answer: null,
    context: getContextSummary(input.context),
    createdAt,
    id: crypto.randomUUID(),
    question: input.question,
    status: "pending",
    ...UNANSWERED,
    updatedAt: createdAt,
  };
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

export function stubTutorApi({
  lesson,
  pageSize,
}: {
  lesson?: PlayableLibraryLesson;
  pageSize?: number;
}) {
  const threadId = crypto.randomUUID();

  const responders: Record<TutorRoute, TutorResponder[]> = {
    answer: [],
    create: [],
    question: [],
    thread: [],
  };

  const clock = { time: Date.parse("2026-01-01T00:00:00.000Z") };

  function stamp() {
    clock.time += 1000;
    return new Date(clock.time).toISOString();
  }

  const createdByRequestId = new Map<string, { input: string; questionId: string }>();

  const api = {
    complete(questionId: string, answer = TUTOR_ANSWER) {
      api.questions = api.questions.map((question) =>
        question.id === questionId
          ? { ...question, answer, status: "completed" as const, updatedAt: stamp() }
          : question,
      );
    },
    fail(route: TutorRoute, status: number) {
      api.next(route, () => Promise.resolve(errorResponse(status)));
    },
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
    question({
      answer = null,
      question,
      status,
      step = 0,
    }: QuestionFields): LessonQuestionResource {
      const createdAt = stamp();
      const context = { kind: "step" as const, stepId: lesson?.steps[step]?.id ?? null };

      return {
        answer,
        context: { ...context, stepNumber: step + 1 },
        createdAt,
        id: crypto.randomUUID(),
        question,
        status,
        ...UNANSWERED,
        updatedAt: createdAt,
      };
    },
    questions: [] as LessonQuestionResource[],
    requests: { answer: 0, create: 0, question: 0, thread: 0 } satisfies Record<TutorRoute, number>,
  };

  function serveThread(url: URL) {
    const page = getThreadPage({ pageSize, questions: api.questions, url });

    return Response.json(
      api.questions.length === 0 ? null : { id: threadId, lessonId: lesson?.id ?? null, ...page },
    );
  }

  async function serveCreate(request: Request) {
    const input = createLessonQuestionInputSchema.parse(await request.json());
    api.inputs = [...api.inputs, input];
    const created = createdByRequestId.get(input.requestId);

    if (created) {
      const question = api.questions.find((candidate) => candidate.id === created.questionId);
      const isSameRequest = created.input === JSON.stringify(input);

      return isSameRequest && question
        ? Response.json({ ...question, missionMoment: null }, { status: 201 })
        : errorResponse(HTTP_STATUS_CONFLICT);
    }

    const question = toPendingQuestion({ createdAt: stamp(), input });

    createdByRequestId.set(input.requestId, {
      input: JSON.stringify(input),
      questionId: question.id,
    });

    api.questions = [...api.questions, question];
    return Response.json({ ...question, missionMoment: null }, { status: 201 });
  }

  function serveQuestion({ questionId }: { questionId: string; request: Request }) {
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
        return serveQuestion(tutorRequest);
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
