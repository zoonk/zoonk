import { readOwnFile, toOwnFileResponse } from "@zoonk/core/files/read-own";

const STATUS = { notFound: 404, unauthorized: 401 } as const;

/**
 * The web's copy of `GET /v1/files/{folder}/{ownerId}/{name}`: serves the signed-in learner one of
 * their own private files, such as a private course's picture in the lesson player. It's on main's
 * origin because an image request sends main's session cookie but no bearer token, and it only
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
