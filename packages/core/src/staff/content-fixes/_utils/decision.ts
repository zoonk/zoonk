import "server-only";
import { type ContentFixStatus, type ContentFixWhereInput, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { type StaffSessionRefusal, type getStaffSessionUser } from "./staff-session";

export type Refused = StaffSessionRefusal | { status: "notFound" };

type ContentFixOutcome = { id: string; staleReason: string | null; status: ContentFixStatus };

export type Decided = {
  /** Whether Main heard about the changes: false means it shows the old content until its cache expires. */
  cacheNotified: boolean | null;
  fixes: ContentFixOutcome[];
  status: "decided";
};

export function readOutcomes(where: ContentFixWhereInput): Promise<ContentFixOutcome[]> {
  return prisma.contentFix.findMany({
    orderBy: { id: "asc" },
    select: { id: true, staleReason: true, status: true },
    where,
  });
}

/** Runs a decision as the signed-in staff person, on a well-formed id. */
export function decideAs<Result>({
  decider,
  id,
  run,
}: {
  decider: Awaited<ReturnType<typeof getStaffSessionUser>>;
  id: string;
  run: (deciderId: string) => Promise<Result>;
}): Promise<Refused | Result> {
  if (decider.status !== "ready") {
    return Promise.resolve(decider);
  }

  return isUuid(id) ? run(decider.userId) : Promise.resolve({ status: "notFound" });
}
