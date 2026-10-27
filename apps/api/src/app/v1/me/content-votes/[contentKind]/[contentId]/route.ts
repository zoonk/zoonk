import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { contentVoteRequestSchema } from "@/lib/openapi/schemas/feedback";
import { readBody, readPathParams } from "@/lib/request-input";
import { contentVoteTargetSchema } from "@zoonk/core/feedback/contract";
import { getContentVote } from "@zoonk/core/feedback/get-vote";
import { voteOnContent } from "@zoonk/core/feedback/vote";
import { type NextRequest, NextResponse } from "next/server";

type ContentVoteContext = RouteContext<"/v1/me/content-votes/[contentKind]/[contentId]">;

/** The learner's own vote on the content named by the path, or 404 when they haven't voted. */
async function getVote(_request: NextRequest, context: ContentVoteContext) {
  const path = await readPathParams(context, contentVoteTargetSchema);

  const result = await getContentVote(path);

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
    readBody(request, contentVoteRequestSchema),
    readPathParams(context, contentVoteTargetSchema),
  ]);

  const result = await voteOnContent({ ...body, ...path });

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
