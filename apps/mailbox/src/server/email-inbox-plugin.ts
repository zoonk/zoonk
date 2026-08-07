import { type IncomingMessage, type ServerResponse } from "node:http";
import { type Plugin } from "vite";
import { type EmailPayload, isEmailPayload } from "../email-payload";
import { type EmailInbox, createEmailInbox } from "./email-inbox";

const EMAILS_PATH = "/api/emails";

/**
 * Adds the development-only inbox API directly to Vite. Keeping the API beside
 * the UI means the feature has one process, one in-memory lifetime, and no
 * runtime surface in any deployed application.
 */
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

/** Handles supported inbox operations after the synchronous Vite middleware has matched the path. */
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

/**
 * Reads the request through the platform Web Stream bridge so message bodies
 * can be parsed without maintaining a second mutable buffering abstraction.
 * Invalid JSON is treated the same as an invalid shape at this local boundary.
 */
async function readEmailPayload(request: IncomingMessage): Promise<EmailPayload | null> {
  try {
    const body = await readRequestBody(request);
    const value: unknown = JSON.parse(body);

    return isEmailPayload(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Buffers one small local JSON request with explicit string chunks. Email size
 * limits remain the provider's concern because this endpoint never leaves the
 * developer's loopback interface.
 */
function readRequestBody(request: IncomingMessage): Promise<string> {
  request.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    const chunks: string[] = [];

    request.on("data", (chunk: string) => chunks.push(chunk));
    request.on("end", () => resolve(chunks.join("")));
    request.on("error", reject);
  });
}

/** Writes every endpoint response with one predictable JSON representation. */
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
