import { isCorsAllowedOrigin } from "@zoonk/utils/url";
import { after } from "next/server";
import { type ErrorPayload, sendErrorEmail } from "./server";

async function handlePost(request: Request): Promise<Response> {
  const origin = request.headers.get("origin") ?? "";

  if (!isCorsAllowedOrigin(origin)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- request body is trusted same-origin
  const body = (await request.json()) as Omit<ErrorPayload, "source">;

  after(() => sendErrorEmail({ ...body, source: "client" }));

  return Response.json({ ok: true });
}

export function toErrorHandler() {
  return { POST: handlePost };
}
