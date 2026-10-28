import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { getAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { liveCallAdmissionResponseSchema } from "@zoonk/core/language/conversations/admission-contract";
import { safeAsync } from "@zoonk/utils/error";

/** The provider key lives only in the API's environment, so the admin reads the controls from it. */
const cachedGetLiveCallControls = cacheAdminData(async () => {
  const session = await assertAdmin();

  const { data } = await safeAsync(() =>
    getAdminApi({ path: "/v1/live-calls/admission", sessionToken: session.session.token }),
  );

  const parsed = liveCallAdmissionResponseSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

export async function getLiveCallControls() {
  return cachedGetLiveCallControls();
}

type LiveCallControls = NonNullable<Awaited<ReturnType<typeof getLiveCallControls>>>;
export type LiveCallConnectionRow = LiveCallControls["connections"][number];
