import { type ProgramKind } from "../../../../packages/core/src/library/activities/programs/program-limits.ts";
import { type SqlTable } from "../../../../packages/core/src/library/activities/programs/sql-setup.ts";
import { runProgram } from "../../../../packages/player/src/activities/_sandbox/run-program.ts";
import { runQuery } from "../../../../packages/player/src/activities/_sandbox/run-query.ts";
import { warmUpSandbox } from "../../../../packages/player/src/activities/_sandbox/sandbox-host.ts";
import { testRegex } from "../../../../packages/player/src/activities/pattern-tester/pattern-results.ts";

type Request =
  | { id: number; kind: ProgramKind; type: "warmUp" }
  | { code: string; id: number; language: "javascript" | "python"; type: "runProgram" }
  | { id: number; query: string; tables: SqlTable[]; type: "runQuery" }
  | {
      id: number;
      pattern: string;
      shouldMatch: string[];
      shouldNotMatch: string[];
      type: "testRegex";
    };

// The object the app injects with androidx.webkit's addWebMessageListener, only into this page's frame.
declare const zoonkSandbox: {
  addEventListener: (type: "message", listener: (event: MessageEvent<string>) => void) => void;
  postMessage: (message: string) => void;
};

async function answer(request: Request): Promise<unknown> {
  switch (request.type) {
    case "warmUp":
      return warmUpSandbox(request.kind);
    case "runProgram":
      return runProgram(request);
    case "runQuery":
      return runQuery(request);
    case "testRegex":
      return testRegex(request.pattern, request);
    default:
      return null;
  }
}

// Learner code decides how much a run prints or a query returns, and the app reads replies on its main thread.
const MAX_REPLY_LENGTH = 1_000_000;

function post(message: string) {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- The injected object only talks to the app, so its postMessage has no target origin.
  zoonkSandbox.postMessage(message);
}

function reply(id: number, result: unknown): string {
  const message = JSON.stringify({ id, result });

  if (message.length > MAX_REPLY_LENGTH) {
    throw new RangeError("The result is too large to send");
  }

  return message;
}

zoonkSandbox.addEventListener("message", (event) => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the app posts to this object, and it sends these requests.
  const request = JSON.parse(event.data) as Request;

  // Learner code can post its own messages to main's host, so a result may not even serialize.
  void answer(request)
    .then((result) => reply(request.id, result))
    .catch((error: unknown) => JSON.stringify({ error: String(error), id: request.id }))
    .then(post);
});

post(JSON.stringify({ type: "loaded" }));
