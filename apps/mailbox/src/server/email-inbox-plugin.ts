import { type IncomingMessage, type ServerResponse } from "node:http";
import { type Plugin } from "vite";
import { type EmailPayload, isEmailPayload } from "../email-payload.ts";
import { type EmailInbox, createEmailInbox } from "./email-inbox.ts";

const EMAILS_PATH = "/api/emails";

export function createEmailInboxPlugin(): Plugin {
  const inbox = createEmailInbox();

  return {
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== EMAILS_PATH) {
          next();
          return;
        }

        void handleEmailRequest({ inbox, request, response }).catch(next);
      });
    },
    name: "local-email-inbox",
  };
}

async function handleEmailRequest({
  inbox,
  request,
  response,
}: {
  inbox: EmailInbox;
  request: IncomingMessage;
  response: ServerResponse;
}): Promise<void> {
  if (request.method === "GET") {
    sendJson({ body: { emails: inbox.list() }, response, status: 200 });
    return;
  }

  if (request.method === "POST") {
    const email = await readEmailPayload(request);

    if (!email) {
      sendJson({ body: { error: "Invalid email payload" }, response, status: 400 });
      return;
    }

    sendJson({ body: inbox.add(email), response, status: 201 });
    return;
  }

  if (request.method === "DELETE") {
    inbox.clear();
    response.statusCode = 204;
    response.end();
    return;
  }

  sendJson({ body: { error: "Method not allowed" }, response, status: 405 });
}

async function readEmailPayload(request: IncomingMessage): Promise<EmailPayload | null> {
  try {
    const body = await readRequestBody(request);
    const value: unknown = JSON.parse(body);

    return isEmailPayload(value) ? value : null;
  } catch {
    return null;
  }
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  request.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    const chunks: string[] = [];

    request.on("data", (chunk: string) => chunks.push(chunk));
    request.on("end", () => resolve(chunks.join("")));
    request.on("error", reject);
  });
}

function sendJson({
  body,
  response,
  status,
}: {
  body: unknown;
  response: ServerResponse;
  status: number;
}): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}
