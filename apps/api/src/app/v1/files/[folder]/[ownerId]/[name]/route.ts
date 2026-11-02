import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { ownFilePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { readOwnFile, toOwnFileResponse } from "@zoonk/core/files/read-own";
import { type NextRequest } from "next/server";

async function getOwnFileRoute(
  request: NextRequest,
  context: RouteContext<"/v1/files/[folder]/[ownerId]/[name]">,
) {
  const parsed = await readPathParams(context, ownFilePathParamsSchema);

  const { folder, name, ownerId } = parsed;

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
