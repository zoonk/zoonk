import "server-only";
import {
  type answerCurrentUserCourseDiscovery,
  getCurrentUserCourseDiscovery,
} from "@zoonk/core/courses/discovery";
import { safeAsync } from "@zoonk/utils/error";

type MutationResult = Awaited<ReturnType<typeof answerCurrentUserCourseDiscovery>>;

/** The answer can be saved before its next AI operation fails; render that durable state with its notice. */
export async function recoverDiscoveryMutation({
  discoveryId,
  expectedRevision,
  mutation,
}: {
  discoveryId: string;
  expectedRevision?: number;
  mutation: () => Promise<MutationResult>;
}) {
  const { data, error } = await safeAsync(mutation);
  const result = error ? { status: "unavailable" as const } : data;

  if (
    result.status === "ready" ||
    result.status === "unauthorized" ||
    result.status === "notFound"
  ) {
    return result;
  }

  const latest = await safeAsync(() => getCurrentUserCourseDiscovery({ discoveryId }));

  if (
    latest.data?.status !== "ready" ||
    (expectedRevision !== undefined && latest.data.discovery.revision <= expectedRevision)
  ) {
    return result;
  }

  return { ...latest.data, notice: result.status === "conflict" ? "refreshed" : result.status };
}
