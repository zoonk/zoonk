import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { streamStatus } from "../stream-status";

async function getActivityForGeneration(activityId: bigint) {
  return prisma.activity.findUnique({
    select: {
      _count: {
        select: {
          steps: true,
        },
      },
      generationRunId: true,
      generationStatus: true,
      id: true,
      kind: true,
      language: true,
      lesson: {
        select: {
          chapter: {
            select: {
              course: {
                select: {
                  organization: {
                    select: {
                      slug: true,
                    },
                  },
                  title: true,
                },
              },
              title: true,
            },
          },
          description: true,
          title: true,
        },
      },
    },
    where: { id: activityId },
  });
}

export type ActivityContext = NonNullable<Awaited<ReturnType<typeof getActivityForGeneration>>>;

export async function getActivityStep(activityId: bigint): Promise<ActivityContext> {
  "use step";

  await streamStatus({ status: "started", step: "getActivity" });

  const { data: activity, error } = await safeAsync(() => getActivityForGeneration(activityId));

  if (error) {
    await streamStatus({ status: "error", step: "getActivity" });
    throw error;
  }

  if (!activity) {
    await streamStatus({ status: "error", step: "getActivity" });
    throw new FatalError("Activity not found");
  }

  await streamStatus({ status: "completed", step: "getActivity" });

  return activity;
}
