import {
  type answerCurrentUserCourseDiscovery,
  type getCurrentUserCourseDiscovery,
  type startCurrentUserCourseDiscovery,
} from "@zoonk/core/courses/discovery";
import { type resolveLearningRequest } from "@zoonk/core/courses/learning-request";
import { NextResponse } from "next/server";
import { errors } from "./api-errors";
import { toLearningPath } from "./learning-plan-responses";

export function learningRequestResponse(
  result: Awaited<ReturnType<typeof resolveLearningRequest>>,
) {
  if (result.kind === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.kind === "invalid") {
    return errors.badRequest("Invalid learning request");
  }

  if (result.kind === "limitReached") {
    return "limit" in result ? errors.generationLimitReached(result.limit) : errors.badRequest();
  }

  if (result.kind === "course") {
    return NextResponse.json({ courseId: result.course.id, kind: "course" });
  }

  if (result.kind === "generate") {
    return NextResponse.json({ coursePromptId: result.prompt.id, kind: "generation" });
  }

  if (result.kind === "discovery") {
    return NextResponse.json({ discoveryId: result.discoveryId, kind: "discovery" });
  }

  if (result.kind === "track") {
    return NextResponse.json({ kind: "track", trackId: result.trackId });
  }

  return NextResponse.json({ kind: result.kind });
}

type DiscoveryResult =
  | Awaited<ReturnType<typeof answerCurrentUserCourseDiscovery>>
  | Awaited<ReturnType<typeof getCurrentUserCourseDiscovery>>
  | Awaited<ReturnType<typeof startCurrentUserCourseDiscovery>>;
export function learningDiscoveryResponse(result: DiscoveryResult) {
  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Discovery or course not found");
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("Choose a valid discovery answer");
  }

  if (result.status === "conflict") {
    return errors.conflict("The discovery changed; reload before continuing");
  }

  if (result.status === "limitReached") {
    return errors.generationLimitReached(result.limit);
  }

  if (result.status === "ready" && "chapters" in result) {
    return NextResponse.json(toLearningPath(result));
  }

  return NextResponse.json(result);
}
