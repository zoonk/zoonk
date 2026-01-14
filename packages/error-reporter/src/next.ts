import { after } from "next/server";

import { type ErrorPayload, sendErrorEmail } from "./server";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!(origin && host)) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function handlePost(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Omit<ErrorPayload, "source">;

  after(() => sendErrorEmail({ ...body, source: "client" }));

  return Response.json({ ok: true });
}

export function toErrorHandler() {
  return { POST: handlePost };
}
