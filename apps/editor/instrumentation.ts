import { sendErrorEmail } from "@zoonk/error-reporter/server";
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const isError = error instanceof Error;

  await sendErrorEmail({
    digest: isError && "digest" in error ? String(error.digest) : undefined,
    message: isError ? error.message : String(error),
    method: request.method,
    path: request.path,
    routeType: context.routeType,
    source: "server",
    stack: isError ? error.stack : undefined,
  });
};
