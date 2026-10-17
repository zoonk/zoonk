import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { contentVoteRequestSchema } from "@/lib/openapi/schemas/feedback";
import { parsePathParams } from "@/lib/path-params";
import { contentVoteTargetSchema } from "@zoonk/core/feedback/contract";
import { getContentVote } from "@zoonk/core/feedback/get-vote";
import { voteOnContent } from "@zoonk/core/feedback/vote";
import { type NextRequest, NextResponse } from "next/server";

type ContentVoteContext = RouteContext<"/v1/me/content-votes/[contentKind]/[contentId]">;

function parseVotePath(context: ContentVoteContext) {
  return context.params.then((params) =>
    parsePathParams({ params, schema: contentVoteTargetSchema }),
  );
}

/** The learner's own vote on the content named by the path, or 404 when they haven't voted. */
async function getVote(_request: NextRequest, context: ContentVoteContext) {
  const path = await parseVotePath(context);

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getContentVote(path.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notVoted") {
    return errors.notFound();
  }

  return NextResponse.json(result.vote);
}

/**
 * Stores the authenticated learner's vote on the content named by the path, so
 * the content id and kind can't disagree with the body.
 */
async function putContentVote(request: NextRequest, context: ContentVoteContext) {
  const [body, path] = await Promise.all([
    parseBody(request, contentVoteRequestSchema),
    parseVotePath(context),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await voteOnContent({ ...body.data, ...path.data });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json(result.vote);
}

export const GET = withApiErrorBoundary(getVote);
export const PUT = withApiErrorBoundary(putContentVote);
