import { hydrateResourceIO, observabilityRevivers } from "workflow/observability";
import { getWorld } from "workflow/runtime";

const COURSE_ID_ATTRIBUTE = "courseId";

const WORKFLOW_NAME =
  "workflow//./src/workflows/v2/courses/course-details-workflow//courseDetailsWorkflow";

function readCourseId(input: unknown): string | null {
  const first: unknown = Array.isArray(input) ? input[0] : null;

  return typeof first === "object" &&
    first !== null &&
    "courseId" in first &&
    typeof first.courseId === "string"
    ? first.courseId
    : null;
}

/** Operational storage is used rather than eventually consistent analytics for recovery safety. */
async function listActiveStatus(status: "pending" | "running", cursor?: string): Promise<string[]> {
  const world = await getWorld();

  const page = await world.runs.list({
    pagination: { cursor },
    resolveData: "all",
    status,
    workflowName: WORKFLOW_NAME,
  });

  const ids = page.data.map((run) => {
    const attribute = run.attributes[COURSE_ID_ATTRIBUTE];

    if (attribute) {
      return attribute;
    }
    /** Runs from before creation-time metadata can still be identified from their stored input. */
    const courseId = readCourseId(hydrateResourceIO(run, observabilityRevivers).input);

    if (!courseId) {
      throw new Error("Cannot identify an active course-details run; refusing copy recovery");
    }

    return courseId;
  });

  return page.hasMore
    ? [...ids, ...(await listActiveStatus(status, page.cursor ?? undefined))]
    : ids;
}

/** Includes pending and running work; terminal runs never prevent a missing-copy retry. */
export async function listInFlightCourseDetails(): Promise<ReadonlySet<string>> {
  /** Vercel's storage API accepts one status per request, unlike the local World's array filter. */
  const lists = await Promise.all([listActiveStatus("pending"), listActiveStatus("running")]);
  return new Set(lists.flat());
}
