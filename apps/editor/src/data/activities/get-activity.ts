import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Activity, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedGetActivity = cache(
  async (
    activityId: bigint,
    orgSlug: string,
    headers?: Headers,
  ): Promise<SafeReturn<Activity | null>> => {
    const { data: activity, error: findError } = await safeAsync(() =>
      prisma.activity.findFirst({
        where: {
          id: activityId,
          organization: { slug: orgSlug },
        },
      }),
    );

    if (findError) {
      return { data: null, error: findError };
    }

    if (!activity) {
      return { data: null, error: null };
    }

    const hasPermission = await hasCoursePermission({
      headers,
      orgId: activity.organizationId,
      permission: "update",
    });

    if (!hasPermission) {
      return { data: null, error: new AppError(ErrorCode.forbidden) };
    }

    return { data: activity, error: null };
  },
);

export function getActivity(params: {
  activityId: bigint;
  headers?: Headers;
  orgSlug: string;
}): Promise<SafeReturn<Activity | null>> {
  return cachedGetActivity(params.activityId, params.orgSlug, params.headers);
}
