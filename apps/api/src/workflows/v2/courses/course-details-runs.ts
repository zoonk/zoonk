import { getWorld } from "workflow/runtime";

const WORKFLOW_NAME =
  "workflow//./src/workflows/v2/courses/course-details-workflow//courseDetailsWorkflow";

/** Operational storage is used rather than eventually consistent analytics for recovery safety. */
async function listActiveStatus(status: "pending" | "running", cursor?: string): Promise<string[]> {
  const world = await getWorld();

  const page = await world.runs.list({
    pagination: { cursor },
    resolveData: "none",
    status,
    workflowName: WORKFLOW_NAME,
  });

  const ids = page.data.map((run) => {
    const courseId = run.attributes.courseId;

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
