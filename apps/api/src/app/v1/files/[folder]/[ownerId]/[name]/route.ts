import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { ownFilePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { readOwnFile, toOwnFileResponse } from "@zoonk/core/files/read-own";
import { type NextRequest } from "next/server";

/**
 * Serves the signed-in learner one of their own private files from the private Blob store, such as
 * a private course's picture. Private files have no public URL, so API responses point here.
 */
async function getOwnFileRoute(
  request: NextRequest,
  context: RouteContext<"/v1/files/[folder]/[ownerId]/[name]">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: ownFilePathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { folder, name, ownerId } = parsed.data;

  const file = await readOwnFile({
    ifNoneMatch: request.headers.get("if-none-match"),
    pathname: `${folder}/${ownerId}/${name}`,
  });

  if (file.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (file.status === "notFound") {
    return errors.notFound("File not found");
  }

  return toOwnFileResponse(file);
}

export const GET = withApiErrorBoundary(getOwnFileRoute);
