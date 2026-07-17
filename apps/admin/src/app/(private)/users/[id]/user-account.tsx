import { getUser } from "@/data/users/get-user";
import { Button } from "@zoonk/ui/components/button";
import { Separator } from "@zoonk/ui/components/separator";
import { updateUserAnalyticsDisabledAction } from "./_actions/update-user-analytics-disabled";
import { DetailField } from "./detail-field";

export async function UserAccount({ userId }: { userId: string }) {
  "use cache: private";

  const user = await getUser(userId);

  if (!user) {
    return null;
  }

  const lastLogin = user.sessions[0]?.updatedAt;
  const providers = user.accounts.map((a) => a.providerId);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">Account</h3>
        <AnalyticsTrackingForm analyticsDisabled={user.analyticsDisabled} userId={user.id} />
      </div>

      <Separator />

      <dl className="mt-2">
        <DetailField label="Email">{user.email}</DetailField>
        <DetailField label="Email verified">{user.emailVerified ? "Yes" : "No"}</DetailField>
        <DetailField label="Analytics">
          {user.analyticsDisabled ? "Excluded" : "Included"}
        </DetailField>

        <DetailField label="Auth providers">
          {providers.length > 0 ? <span className="capitalize">{providers.join(", ")}</span> : "—"}
        </DetailField>

        <DetailField label="Joined">{new Date(user.createdAt).toLocaleDateString()}</DetailField>
        <DetailField label="Last updated">
          {new Date(user.updatedAt).toLocaleDateString()}
        </DetailField>

        <DetailField label="Last login">
          {lastLogin ? new Date(lastLogin).toLocaleDateString() : "—"}
        </DetailField>
      </dl>
    </section>
  );
}

/**
 * A plain form keeps this admin-only toggle usable without adding client state,
 * while still sending the exact target state the server action should persist.
 */
function AnalyticsTrackingForm({
  analyticsDisabled,
  userId,
}: {
  analyticsDisabled: boolean;
  userId: string;
}) {
  const nextValue = !analyticsDisabled;

  return (
    <form action={updateUserAnalyticsDisabledAction}>
      <input name="userId" type="hidden" value={userId} />
      <input name="analyticsDisabled" type="hidden" value={String(nextValue)} />
      <Button size="sm" type="submit" variant="outline">
        {analyticsDisabled ? "Include in analytics" : "Exclude from analytics"}
      </Button>
    </form>
  );
}
