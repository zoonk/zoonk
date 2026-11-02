import { readOwnFile, toOwnFileResponse } from "@zoonk/core/files/read-own";

const STATUS = { notFound: 404, unauthorized: 401 } as const;

/**
 * On main's origin because an image request sends main's session cookie but no bearer token. It only
 * reads, so it needs no same-origin check.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/files/[folder]/[ownerId]/[name]">,
) {
  const { folder, name, ownerId } = await context.params;

  const file = await readOwnFile({
    ifNoneMatch: request.headers.get("if-none-match"),
    pathname: `${folder}/${ownerId}/${name}`,
  });

  if (file.status === "unauthorized" || file.status === "notFound") {
    return new Response(null, { status: STATUS[file.status] });
  }

  return toOwnFileResponse(file);
}
